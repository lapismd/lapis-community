import { isBuzzDirectMetadata } from "./buzz-direct-messages.js";
import type {
  CommunityRelay,
  CommunityRelayFactory,
  CommunityRelaySubscription,
  RelayFilter,
} from "../nostr/index.js";
import { authenticateRegistryRelay } from "../auth/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import { isRegistryControlEvent } from "../protocol/registry-control.js";

import { communityRooms } from "./materialize.js";
import {
  COMMUNITY_CANVAS_KIND,
  CommunityCanvasConflictError,
  canvasEditingAllowed,
  canvasReadingAllowed,
  latestChannelCanvas,
  validateCanvasContent,
} from "./channel-canvas.js";
import { createNip17GiftWraps, unwrapNip17GiftWrap } from "./nip17.js";
import type {
  CommunityCapabilities,
  CommunityCommand,
  CommunityGroupLoadRequest,
  CommunityGroupLoadResult,
  CommunityContentWindow,
  CommunityContentWindowRequest,
  CommunityDataSource,
  CommunityDataSourceContext,
  CommunityPrivateEvent,
  CommunityPulseWindow,
  CommunityPulseWindowRequest,
  CommunityRoomScope,
  CommunityScope,
  CommunitySearchResult,
  CommunitySession,
  CommunitySessionSubscription,
  CommunitySnapshot,
  CommunitySynchronizationRequest,
} from "./contracts.js";
import {
  isNip34ProjectComment,
  pulseEventTargetId,
  pulseReplyParentId,
} from "./materialize-pulse.js";
import { verifiedNostrEvent } from "./verified-events.js";
import { createCommunityAgentSession } from "./agent-session.js";
import { createCommunityPresenceSession } from "./presence-session.js";
import type { CommunityPresenceSession } from "./presence-contracts.js";
import type { CommunityAgentSession } from "./agent-contracts.js";

export interface Nip29CommunitySourceOptions {
  presence?: boolean;
  relayFactory: CommunityRelayFactory;
  searchLimit?: number;
  /** Hosts may omit the optional agent surface for sources without a bridge. */
  agents?: boolean;
  /** Inject the Buzz-compatible HTTP bridge transport. */
  fetch?: typeof globalThis.fetch;
}

const COMMUNITY_CONTENT_KINDS = [5, 7, 9, 11, 1_111, 9_005, 40_003] as const;
const COMMUNITY_CHANNEL_ACTIVITY_KINDS = [
  9_000, 9_001, 9_007, 9_021, 9_022,
] as const;
const COMMUNITY_STATE_KINDS = [39_000, 39_001, 39_002, 39_003] as const;
const PUBLIC_ROOM_DISCOVERY_LIMIT = 1_000;
const PULSE_NOTE_LIMIT = 50;
const PULSE_FOLLOWING_LIMIT = 200;
const PULSE_MAX_FOLLOWS = 100;

export function createNip29CommunitySource(
  options: Nip29CommunitySourceOptions,
): CommunityDataSource {
  const preparedDirect = new WeakMap<
    object,
    {
      wraps: NostrEvent[];
      deliveries: {
        recipient: string;
        relayUrl: string;
        event: NostrEvent;
        accepted: boolean;
        error?: string;
      }[];
    }
  >();
  return {
    historyPaging: true,
    async open(scope, context = {}, signal) {
      signal?.throwIfAborted();
      return new Nip29CommunitySession(scope, context, options, preparedDirect);
    },
  };
}

class Nip29CommunitySession implements CommunitySession {
  readonly presence: CommunityPresenceSession | undefined;
  readonly agents: CommunityAgentSession | undefined;
  readonly #scope: CommunityScope;
  readonly #context: CommunityDataSourceContext;
  readonly #options: Nip29CommunitySourceOptions;
  readonly #relays: CommunityRelay[];
  readonly #authority: CommunityRelay;
  readonly #subscriptions = new Set<CommunityRelaySubscription>();
  readonly #listeners = new Set<(events: readonly NostrEvent[]) => void>();
  readonly #authenticated = new WeakSet<CommunityRelay>();
  readonly #deliveryRelays = new Map<string, CommunityRelay>();
  readonly #preparedDirect: WeakMap<
    object,
    {
      wraps: NostrEvent[];
      deliveries: {
        recipient: string;
        relayUrl: string;
        event: NostrEvent;
        accepted: boolean;
        error?: string;
      }[];
    }
  >;
  #buzzDirectSupported = false;
  #relaySigningPubkey: string | undefined;
  #capabilitiesLoaded = false;
  #privateCursor: import("./contracts.js").CommunityContentCursor | undefined;
  readonly #privateCoverageGaps = new Map<
    number,
    import("./contracts.js").CommunityContentCursor
  >();
  #closed = false;
  #baseSubscriptionsStarted = false;
  #lastCommandCreatedAt = 0;
  #knownGroupIds = new Set<string>();
  #roomSubscriptionIds = new Set<string>();
  #targetSubscriptionKeys = new Set<string>();
  readonly #subscriptionAbort = new AbortController();
  readonly #registrationReads = new Map<string, Promise<void>>();

  constructor(
    scope: CommunityScope,
    context: CommunityDataSourceContext,
    options: Nip29CommunitySourceOptions,
    preparedDirect: WeakMap<
      object,
      {
        wraps: NostrEvent[];
        deliveries: {
          recipient: string;
          relayUrl: string;
          event: NostrEvent;
          accepted: boolean;
          error?: string;
        }[];
      }
    >,
  ) {
    this.#preparedDirect = preparedDirect;
    this.#scope = scope;
    this.#context = context;
    this.#options = options;
    const urls = distinctRelayUrls(scope);
    this.#relays = urls.map((url) => options.relayFactory.create(url));
    const authorityUrl = normalizeRelayUrl(scope.relayUrl);
    this.#authority =
      this.#relays.find((relay) => relay.url === authorityUrl) ??
      options.relayFactory.create(authorityUrl);
    this.agents =
      context.identity === undefined || options.agents === false
        ? undefined
        : createCommunityAgentSession({
            scope,
            identity: context.identity,
            relay: this.#authority,
            authenticate: (signal) =>
              this.#authenticate(this.#authority, signal),
            ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
          });
    this.presence =
      context.identity === undefined || options.presence === false
        ? undefined
        : createCommunityPresenceSession({
            identity: context.identity,
            relay: this.#authority,
            authenticate: (signal) =>
              this.#authenticate(this.#authority, signal),
            ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
          });
    for (const room of communityRooms(scope)) {
      this.#knownGroupIds.add(room.groupId);
    }
  }

  async snapshot(signal?: AbortSignal): Promise<CommunitySnapshot> {
    return this.#snapshot(undefined, signal);
  }

  async synchronize(
    request: CommunitySynchronizationRequest,
    signal?: AbortSignal,
  ): Promise<CommunitySnapshot> {
    return this.#snapshot(request, signal);
  }

  async loadContentWindow(
    request: CommunityContentWindowRequest,
    signal?: AbortSignal,
  ): Promise<CommunityContentWindow> {
    this.#assertOpen(signal);
    if (request.groupId.trim() === "") {
      throw new Error("A community content window requires a group ID");
    }
    if (request.collection === "thread" && !request.rootEventId) {
      throw new Error("A thread content window requires a root event ID");
    }
    await Promise.all(
      this.#relays.map(async (relay) => this.#authenticate(relay, signal)),
    );
    const requestedLimit = Math.floor(request.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(100, requestedLimit))
      : 1;
    const filter = {
      ...contentWindowFilter(request),
      ...(request.after
        ? { since: Math.max(0, request.after.createdAt - 1) }
        : {}),
    };
    const contentPage = await this.#queryContentPage(
      filter,
      request.collection,
      request.before,
      limit,
      signal,
    );
    const page = contentPage;
    const scanCursor = contentPage.cursor;
    const targets = page.events.map((event) => event.id);
    const referenced =
      targets.length === 0
        ? []
        : await this.#queryUnion(
            this.#relays,
            {
              kinds: [5, 7, 9_005, 40_003],
              "#e": targets,
              limit: 100,
            },
            signal,
          );
    const authors = [
      ...new Set(
        [...page.events, ...referenced].flatMap((event) => [
          event.pubkey,
          ...event.tags
            .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
            .map((tag) => tag[1]!),
        ]),
      ),
    ];
    const profiles =
      authors.length === 0
        ? []
        : await this.#queryUnion(
            this.#relays,
            { kinds: [0, 30_030, 30_315], authors, limit: authors.length * 3 },
            signal,
          );
    await this.#subscribeToTargets(targets, signal);
    await this.#subscribeToProfiles(authors, signal);
    return {
      events: distinctEvents([
        ...page.events,
        ...page.supporting,
        ...referenced,
        ...profiles,
      ]),
      primaryEventIds: page.events.map((event) => event.id),
      ...(scanCursor
        ? { olderCursor: scanCursor }
        : page.events[0]
          ? {
              olderCursor: {
                createdAt: page.events[0].created_at,
                eventId: page.events[0].id,
              },
            }
          : {}),
      ...(page.coverageGaps.length ? { coverageGaps: page.coverageGaps } : {}),
      hasOlder: page.hasOlder,
    };
  }

  async loadInboxWindow(
    before?: CommunityContentWindowRequest["before"],
    limit = 50,
    signal?: AbortSignal,
  ): Promise<CommunityContentWindow> {
    const pubkey = await this.#context.identity?.getPublicKey();
    const groupIds = [...this.#knownGroupIds];
    if (!pubkey || groupIds.length === 0)
      return { events: [], primaryEventIds: [], hasOlder: false };
    const boundary = before ? { until: before.createdAt } : {};
    const [mentioned, authored] = await Promise.all([
      this.#queryUnion(
        this.#relays,
        {
          kinds: [9, 11, 1111],
          "#h": groupIds,
          "#p": [pubkey],
          ...boundary,
          limit: 100,
        },
        signal,
      ),
      this.#queryUnion(
        this.#relays,
        {
          kinds: [9, 11, 1111],
          "#h": groupIds,
          authors: [pubkey],
          ...boundary,
          limit: 100,
        },
        signal,
      ),
    ]);
    const candidates = distinctEvents([...mentioned, ...authored]).filter(
      (event) =>
        !before ||
        event.created_at < before.createdAt ||
        (event.created_at === before.createdAt && event.id < before.eventId),
    );
    const selected = candidates.slice(-Math.min(50, limit));
    const roots = [
      ...new Set(
        selected.flatMap((event) =>
          event.tags
            .filter((tag) => tag[0] === "E" || tag[0] === "e")
            .map((tag) => tag[1]!),
        ),
      ),
    ].slice(0, 100);
    const context = roots.length
      ? await this.#queryUnion(
          this.#relays,
          { kinds: [9, 11], "#h": groupIds, ids: roots, limit: 100 },
          signal,
        )
      : [];
    const oldest = selected[0];
    return {
      events: distinctEvents([...selected, ...context]),
      primaryEventIds: selected.map((event) => event.id),
      hasOlder:
        candidates.length > selected.length ||
        mentioned.length === 100 ||
        authored.length === 100,
      ...(oldest
        ? { olderCursor: { createdAt: oldest.created_at, eventId: oldest.id } }
        : {}),
    };
  }

  async loadPulseWindow(
    request: CommunityPulseWindowRequest,
    signal?: AbortSignal,
  ): Promise<CommunityPulseWindow> {
    this.#assertOpen(signal);
    await Promise.all(
      this.#relays.map(async (relay) => this.#authenticate(relay, signal)),
    );
    const identityPubkey = await this.#context.identity?.getPublicKey();
    const supporting: NostrEvent[] = [];
    let primary: NostrEvent[] = [];
    let requestedOrder: string[] | undefined;

    if (request.noteIds !== undefined) {
      const noteIds = [...new Set(request.noteIds)].slice(
        0,
        PULSE_FOLLOWING_LIMIT,
      );
      primary =
        noteIds.length === 0
          ? []
          : verifiedPulseEvents(
              await this.#queryUnion(
                this.#relays,
                { ids: noteIds, kinds: [1], limit: noteIds.length },
                signal,
              ),
            );
      requestedOrder = noteIds;
    } else if (request.tab === "everyone") {
      primary = verifiedPulseEvents(
        await this.#queryUnion(
          this.#relays,
          { kinds: [1], limit: PULSE_NOTE_LIMIT },
          signal,
        ),
      );
    } else if (request.tab === "agents") {
      const authors = [...new Set(request.agentPubkeys ?? [])];
      primary =
        authors.length === 0
          ? []
          : verifiedPulseEvents(
              await this.#queryUnion(
                this.#relays,
                { kinds: [1], authors, limit: PULSE_FOLLOWING_LIMIT },
                signal,
              ),
            );
    } else {
      if (identityPubkey === undefined) {
        throw new Error(`Sign in to view ${request.tab}`);
      }
      if (request.tab === "mine") {
        primary = verifiedPulseEvents(
          await this.#queryUnion(
            this.#relays,
            { kinds: [1], authors: [identityPubkey], limit: PULSE_NOTE_LIMIT },
            signal,
          ),
        );
      } else if (request.tab === "following") {
        const contacts = verifiedPulseEvents(
          await this.#queryUnion(
            this.#relays,
            { kinds: [3], authors: [identityPubkey], limit: 25 },
            signal,
          ),
        );
        const latestContacts = contacts.at(-1);
        if (latestContacts !== undefined) supporting.push(latestContacts);
        const followed = [
          ...new Set(
            latestContacts?.tags
              .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
              .map((tag) => tag[1]!) ?? [],
          ),
        ].slice(0, PULSE_MAX_FOLLOWS);
        primary =
          followed.length === 0
            ? []
            : verifiedPulseEvents(
                await this.#queryUnion(
                  this.#relays,
                  {
                    kinds: [1],
                    authors: followed,
                    limit: PULSE_FOLLOWING_LIMIT,
                  },
                  signal,
                ),
              );
      } else {
        const likes = verifiedPulseEvents(
          await this.#queryUnion(
            this.#relays,
            { kinds: [7], authors: [identityPubkey], limit: 1_000 },
            signal,
          ),
        ).filter((event) => event.content === "+");
        const likeIds = likes.map((event) => event.id);
        const deletions =
          likeIds.length === 0
            ? []
            : verifiedPulseEvents(
                await this.#queryUnion(
                  this.#relays,
                  {
                    kinds: [5],
                    authors: [identityPubkey],
                    "#e": likeIds,
                    limit: Math.max(50, likeIds.length * 2),
                  },
                  signal,
                ),
              );
        supporting.push(...likes, ...deletions);
        const deletedLikes = new Set(
          deletions.flatMap((event) =>
            event.tags
              .filter((tag) => tag[0] === "e" && tag[1] !== undefined)
              .map((tag) => tag[1]!),
          ),
        );
        const activeLikes = likes
          .filter((event) => !deletedLikes.has(event.id))
          .toSorted(
            (left, right) =>
              right.created_at - left.created_at ||
              right.id.localeCompare(left.id),
          );
        requestedOrder = [
          ...new Set(
            activeLikes.flatMap((event) => pulseEventTargetId(event) ?? []),
          ),
        ];
        primary =
          requestedOrder.length === 0
            ? []
            : verifiedPulseEvents(
                await this.#queryUnion(
                  this.#relays,
                  {
                    ids: requestedOrder,
                    kinds: [1],
                    limit: requestedOrder.length,
                  },
                  signal,
                ),
              );
      }
    }

    primary = primary.filter(
      (event) => event.kind === 1 && !isNip34ProjectComment(event),
    );
    const primaryById = new Map(primary.map((event) => [event.id, event]));
    const primaryEventIds = (
      requestedOrder ??
      primary
        .toSorted(
          (left, right) =>
            right.created_at - left.created_at ||
            right.id.localeCompare(left.id),
        )
        .map((event) => event.id)
    ).filter((id) => primaryById.has(id));
    const parentIds = [
      ...new Set(primary.flatMap((event) => pulseReplyParentId(event) ?? [])),
    ];
    const parents =
      parentIds.length === 0
        ? []
        : verifiedPulseEvents(
            await this.#queryUnion(
              this.#relays,
              { ids: parentIds, kinds: [1], limit: parentIds.length },
              signal,
            ),
          );
    const reactions =
      primaryEventIds.length === 0
        ? []
        : verifiedPulseEvents(
            await this.#queryUnion(
              this.#relays,
              {
                kinds: [7],
                "#e": primaryEventIds,
                limit: Math.min(
                  2_000,
                  Math.max(100, primaryEventIds.length * 20),
                ),
              },
              signal,
            ),
          );
    const deletionTargets = [
      ...new Set([
        ...primaryEventIds,
        ...parents.map((event) => event.id),
        ...reactions.map((event) => event.id),
      ]),
    ];
    const deletions =
      deletionTargets.length === 0
        ? []
        : verifiedPulseEvents(
            await this.#queryUnion(
              this.#relays,
              {
                kinds: [5],
                "#e": deletionTargets,
                limit: Math.min(
                  2_000,
                  Math.max(100, deletionTargets.length * 4),
                ),
              },
              signal,
            ),
          );
    const authors = [
      ...new Set(
        [...primary, ...parents].flatMap((event) => [
          event.pubkey,
          ...event.tags
            .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
            .map((tag) => tag[1]!),
        ]),
      ),
    ];
    const profiles =
      authors.length === 0
        ? []
        : verifiedPulseEvents(
            await this.#queryUnion(
              this.#relays,
              { kinds: [0], authors, limit: authors.length * 3 },
              signal,
            ),
          );
    return {
      events: distinctEvents([
        ...primary,
        ...parents,
        ...reactions,
        ...deletions,
        ...profiles,
        ...supporting,
      ]),
      primaryEventIds,
    };
  }

  async #snapshot(
    request: CommunitySynchronizationRequest | undefined,
    signal?: AbortSignal,
  ): Promise<CommunitySnapshot> {
    this.#assertOpen(signal);
    await this.#loadBuzzCapability(signal);
    await Promise.all(
      this.#relays.map(async (relay) => this.#authenticate(relay, signal)),
    );
    const identityPubkey = await this.#context.identity?.getPublicKey();
    const configuredPrivateIds = (this.#scope.rooms ?? [])
      .filter((room) => room.private || room.transport === "buzz-dm")
      .map((room) => room.groupId);
    const configuredPrivateState = configuredPrivateIds.length
      ? await this.#queryUnion(
          [this.#authority],
          { kinds: [39000, 39002], "#d": configuredPrivateIds },
          signal,
        )
      : [];
    const discoveredMetadata = this.#scope.discoverPublicRooms
      ? await this.#queryUnion(
          [this.#authority],
          { kinds: [39_000], limit: PUBLIC_ROOM_DISCOVERY_LIMIT },
          signal,
        )
      : [];
    const discoveredMemberships =
      this.#scope.discoverPublicRooms && identityPubkey !== undefined
        ? await this.#queryUnion(
            [this.#authority],
            {
              kinds: [39_002],
              "#p": [identityPubkey],
              limit: PUBLIC_ROOM_DISCOVERY_LIMIT,
            },
            signal,
          )
        : [];
    const memberGroupIds = [
      ...new Set(
        verifiedCommunityEvents(discoveredMemberships)
          .filter((event) =>
            event.tags.some(
              (tag) => tag[0] === "p" && tag[1] === identityPubkey,
            ),
          )
          .flatMap((event) =>
            event.tags
              .filter((tag) => tag[0] === "d" && tag[1] !== undefined)
              .map((tag) => tag[1]!),
          ),
      ),
    ];
    const memberMetadata =
      memberGroupIds.length === 0
        ? []
        : await this.#queryUnion(
            [this.#authority],
            { kinds: [39_000], "#d": memberGroupIds },
            signal,
          );
    const discoveryEvents = distinctEvents([
      ...configuredPrivateState,
      ...discoveredMetadata,
      ...discoveredMemberships,
      ...memberMetadata,
      ...(this.#buzzDirectSupported && identityPubkey
        ? await this.#queryUnion(
            [this.#authority],
            { kinds: [30622], "#p": [identityPubkey] },
            signal,
          )
        : []),
    ]);
    const rooms = communityRooms(this.#scope, discoveryEvents, identityPubkey);
    const groupIds = [
      ...new Set([
        ...rooms.map((room) => room.groupId),
        ...this.#knownGroupIds,
      ]),
    ];
    for (const groupId of groupIds) this.#knownGroupIds.add(groupId);
    await this.#subscribeToRooms(groupIds, signal);

    const bootstrap = request?.strategy === "bootstrap";
    const inboxWindow = bootstrap
      ? await this.loadInboxWindow(undefined, 50, signal)
      : undefined;
    const contentSince = synchronizationSince(request);
    const content =
      bootstrap || groupIds.length === 0
        ? []
        : await this.#queryUnion(
            this.#relays,
            {
              kinds: [...COMMUNITY_CONTENT_KINDS],
              "#h": groupIds,
              ...(contentSince === undefined ? {} : { since: contentSince }),
            },
            signal,
          );
    const activity =
      bootstrap || groupIds.length === 0
        ? []
        : await this.#queryUnion(
            [this.#authority],
            {
              kinds: [...COMMUNITY_CHANNEL_ACTIVITY_KINDS],
              "#h": groupIds,
              ...(contentSince === undefined ? {} : { since: contentSince }),
            },
            signal,
          );
    const state =
      groupIds.length === 0
        ? []
        : await this.#queryUnion(
            [this.#authority],
            { kinds: [...COMMUNITY_STATE_KINDS], "#d": groupIds },
            signal,
          );
    const targets = [...content, ...activity, ...state].map(
      (event) => event.id,
    );
    const referenced =
      targets.length === 0
        ? []
        : await this.#queryUnion(
            this.#relays,
            { kinds: [5, 7, 9_005, 40_003], "#e": targets },
            signal,
          );
    const authors = [
      ...new Set(
        [...content, ...activity, ...state, ...referenced]
          .map((event) => event.pubkey)
          .concat(
            activity.flatMap((event) =>
              event.tags
                .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
                .map((tag) => tag[1]!),
            ),
            state.flatMap((event) =>
              event.tags
                .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
                .map((tag) => tag[1]!),
            ),
            identityPubkey ?? [],
          ),
      ),
    ];
    const profiles =
      authors.length === 0
        ? []
        : await this.#queryUnion(
            this.#relays,
            { kinds: [0, 30_030, 30_315], authors },
            signal,
          );
    await this.#subscribeToProfiles(authors, signal);
    const relayPreferences = await this.#relayPreferences(
      identityPubkey === undefined ? [] : [identityPubkey],
      signal,
    );
    const inboxUrls =
      identityPubkey === undefined
        ? []
        : (relayPreferences.urls.get(identityPubkey) ?? []);
    await this.#subscribeToInbox(inboxUrls, identityPubkey, signal);
    const inboxCheckpoint = request?.plan.checkpoints.find(
      (checkpoint) => checkpoint.stream === `inbox:${identityPubkey}`,
    );
    const privateAfter =
      inboxCheckpoint && inboxCheckpoint.createdAt > 0
        ? {
            createdAt: Math.max(0, inboxCheckpoint.createdAt - 172_800),
            eventId: "",
          }
        : undefined;
    const privateResult = await this.#loadPrivateEvents(
      inboxUrls,
      signal,
      undefined,
      privateAfter,
    );
    await this.#subscribeToTargets(targets, signal);
    const synchronizedAt = Math.floor(Date.now() / 1_000);
    const previousCreatedAt = Math.max(
      0,
      ...(request?.plan.checkpoints
        .filter((checkpoint) => checkpoint.stream === "content")
        .map((checkpoint) => checkpoint.createdAt) ?? []),
    );
    const createdAt = Math.max(
      previousCreatedAt,
      ...content.map((event) => event.created_at),
      ...activity.map((event) => event.created_at),
    );
    return {
      events: distinctEvents([
        ...discoveryEvents,
        ...(inboxWindow?.events ?? []),
        ...content,
        ...activity,
        ...state,
        ...referenced,
        ...profiles,
        ...relayPreferences.events,
      ]),
      ...(privateResult.wraps.length === 0
        ? {}
        : { encryptedEvents: privateResult.wraps }),
      ...(privateResult.events.length === 0
        ? {}
        : { privateEvents: privateResult.events }),
      ...(identityPubkey
        ? {
            encryptedPage: this.#encryptedPage(
              identityPubkey,
              inboxUrls,
              privateResult,
              undefined,
              privateAfter,
            ),
            encryptedCheckpoints: (inboxUrls.length
              ? inboxUrls
              : this.#relays.map((relay) => relay.url)
            ).map((relayUrl) => ({
              relayUrl,
              stream: `inbox:${identityPubkey}`,
              createdAt:
                privateResult.hasOlder || privateResult.coverageGaps?.length
                  ? (inboxCheckpoint?.createdAt ?? 0)
                  : synchronizedAt,
              synchronizedAt,
              complete:
                !privateResult.hasOlder && !privateResult.coverageGaps?.length,
            })),
          }
        : {}),
      ...(inboxWindow?.olderCursor
        ? { inboxCursor: inboxWindow.olderCursor }
        : {}),
      ...(inboxWindow ? { hasOlderInbox: inboxWindow.hasOlder } : {}),
      capabilities: this.#capabilities(),
      hasOlderDirectMessages: privateResult.hasOlder,
      ...(bootstrap
        ? {}
        : {
            checkpoints: this.#relays.map((relay) => ({
              relayUrl: relay.url,
              stream: "content",
              createdAt,
              synchronizedAt,
            })),
          }),
      complete:
        !bootstrap &&
        (request === undefined || request.plan.checkpoints.length === 0),
    };
  }

  async #queryContentPage(
    filter: RelayFilter,
    collection: CommunityContentWindowRequest["collection"],
    before: CommunityContentWindowRequest["before"],
    limit: number,
    signal?: AbortSignal,
  ): Promise<{
    events: NostrEvent[];
    supporting: NostrEvent[];
    hasOlder: boolean;
    cursor?: CommunityContentWindowRequest["before"];
    coverageGaps: NonNullable<CommunityContentWindow["coverageGaps"]>;
  }> {
    const primary = new Map<string, NostrEvent>();
    const candidatesById = new Map<string, NostrEvent>();
    const supporting = (selected: readonly NostrEvent[]) => {
      const ids = new Set(selected.map((event) => event.id));
      return [...candidatesById.values()].filter(
        (event) =>
          !ids.has(event.id) &&
          event.tags.some(
            (tag) =>
              (tag[0] === "e" || tag[0] === "E") && ids.has(tag[1] ?? ""),
          ),
      );
    };
    const gaps = new Map<number, { createdAt: number; eventId: string }>();
    let cursor = before;
    let hasOlder = false;
    for (let batch = 0; batch < 3; batch++) {
      if (batch > 0)
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      signal?.throwIfAborted();
      const requests = this.#relays.flatMap((relay) => {
        const kinds = [...(filter.kinds ?? [])];
        if (
          relay === this.#authority &&
          (collection === "channel-roots" || collection === "room-history")
        )
          kinds.push(...COMMUNITY_CHANNEL_ACTIVITY_KINDS);
        const base = {
          ...filter,
          kinds,
          ...(cursor ? { until: cursor.createdAt } : {}),
        };
        const filters: RelayFilter[] =
          collection === "thread"
            ? [
                { ...base, kinds: [9], limit: 50 },
                {
                  kinds: [1111],
                  "#h": filter["#h"]!,
                  "#E": filter["#e"]!,
                  ...(base.since === undefined ? {} : { since: base.since }),
                  ...(base.until === undefined ? {} : { until: base.until }),
                  limit: 50,
                },
              ]
            : [{ ...base, limit: 100 }];
        return filters.map(async (candidateFilter) => {
          const events = await relay.query(candidateFilter, signal);
          return {
            events: events.slice(0, candidateFilter.limit!),
            full: events.length >= candidateFilter.limit!,
          };
        });
      });
      const responses = await Promise.all(requests);
      signal?.throwIfAborted();
      for (const response of responses) {
        if (
          response.full &&
          response.events.length &&
          response.events.every(
            (event) => event.created_at === response.events[0]!.created_at,
          )
        ) {
          const event = response.events[0]!;
          gaps.set(event.created_at, {
            createdAt: event.created_at,
            eventId: event.id,
          });
        }
      }
      const candidates = distinctEvents(
        responses.flatMap((response) => response.events),
      ).filter(
        (event) =>
          verifiedNostrEvent(event) !== undefined &&
          (!cursor ||
            event.created_at < cursor.createdAt ||
            (event.created_at === cursor.createdAt &&
              event.id.localeCompare(cursor.eventId) < 0)),
      );
      for (const event of candidates) {
        candidatesById.set(event.id, event);
        if (contentWindowPrimary(event, collection))
          primary.set(event.id, event);
      }
      const selected = distinctEvents([...primary.values()]).slice(-limit);
      hasOlder =
        responses.some((response) => response.full) ||
        primary.size > selected.length;
      const oldest = candidates[0];
      if (oldest) cursor = { createdAt: oldest.created_at, eventId: oldest.id };
      else if (cursor && hasOlder)
        cursor = { createdAt: cursor.createdAt - 1, eventId: "~" };
      if (selected.length >= limit || !hasOlder)
        return {
          events: selected,
          supporting: supporting(selected),
          hasOlder,
          coverageGaps: [...gaps.values()],
          ...(selected.length >= limit
            ? {
                cursor: {
                  createdAt: selected[0]!.created_at,
                  eventId: selected[0]!.id,
                },
              }
            : cursor
              ? { cursor }
              : {}),
        };
    }
    return {
      events: distinctEvents([...primary.values()]).slice(-limit),
      supporting: supporting(
        distinctEvents([...primary.values()]).slice(-limit),
      ),
      hasOlder,
      coverageGaps: [...gaps.values()],
      ...(cursor ? { cursor } : {}),
    };
  }

  async #queryRawContentPage(
    filter: RelayFilter,
    before: CommunityContentWindowRequest["before"],
    limit: number,
    signal: AbortSignal | undefined,
    relays: readonly CommunityRelay[],
  ) {
    const responses = await Promise.all(
      relays.map((relay) =>
        relay.query(
          {
            ...filter,
            ...(before ? { until: before.createdAt } : {}),
            limit: Math.min(100, limit),
          },
          signal,
        ),
      ),
    );
    signal?.throwIfAborted();
    const candidates = distinctEvents(
      responses.flatMap((events) => events.slice(0, limit)),
    ).filter(
      (event) =>
        verifiedNostrEvent(event) !== undefined &&
        (!before ||
          event.created_at < before.createdAt ||
          (event.created_at === before.createdAt &&
            event.id.localeCompare(before.eventId) < 0)),
    );
    const events = candidates.slice(-limit);
    const hasOlder =
      candidates.length > events.length ||
      responses.some((events) => events.length >= limit);
    const coverageGaps = responses
      .filter(
        (events) =>
          events.length >= limit &&
          events.every((event) => event.created_at === events[0]!.created_at),
      )
      .map((events) => ({
        createdAt: events[0]!.created_at,
        eventId: events[0]!.id,
      }));
    const oldest = events[0];
    const cursor = oldest
      ? { createdAt: oldest.created_at, eventId: oldest.id }
      : before && hasOlder
        ? { createdAt: before.createdAt - 1, eventId: "~" }
        : before;
    return { events, hasOlder, coverageGaps, ...(cursor ? { cursor } : {}) };
  }

  async subscribe(
    listener: (events: readonly NostrEvent[]) => void,
    signal?: AbortSignal,
  ): Promise<CommunitySessionSubscription> {
    this.#assertOpen(signal);
    this.#listeners.add(listener);
    const groupIds = communityRooms(this.#scope).map((room) => room.groupId);
    if (!this.#baseSubscriptionsStarted) {
      this.#baseSubscriptionsStarted = true;
      await Promise.all(
        this.#relays.map(async (relay) => this.#authenticate(relay, signal)),
      );
      await this.#subscribeToRooms(groupIds, signal);
      if (this.#scope.discoverPublicRooms) {
        const discoverySubscription = await this.#authority.subscribe(
          { kinds: [39_000] },
          {
            onevent: (event) => {
              this.#emit([event]);
              const discovered = communityRooms({ ...this.#scope, rooms: [] }, [
                event,
              ]);
              const discoveredGroupId = discovered[0]?.groupId;
              if (discoveredGroupId !== undefined) {
                this.#knownGroupIds.add(discoveredGroupId);
                void this.#subscribeToRooms([discoveredGroupId], signal).catch(
                  () => undefined,
                );
              }
            },
          },
          signal,
        );
        this.#subscriptions.add(discoverySubscription);
      }
      const identityPubkey = await this.#context.identity?.getPublicKey();
      if (
        identityPubkey !== undefined &&
        this.#context.identity?.nip44 !== undefined
      ) {
        await Promise.all(
          this.#relays.map((relay) =>
            this.#registerLive(relay, {
              kinds: [1059],
              "#p": [identityPubkey],
              limit: 0,
            }),
          ),
        );
      }
    }
    let closed = false;
    return {
      close: () => {
        if (closed) return;
        closed = true;
        this.#listeners.delete(listener);
      },
    };
  }

  async execute(
    command: CommunityCommand,
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]> {
    this.#assertOpen(signal);
    const identity = this.#context.identity;
    if (identity === undefined)
      throw new Error("A community identity is required");
    await this.#authenticate(this.#authority, signal);
    if (command.type === "save-canvas") {
      validateCanvasContent(command.content);
      const group = await this.loadGroup({ groupId: command.groupId }, signal);
      if (
        !canvasEditingAllowed(
          group.events,
          command.groupId,
          await identity.getPublicKey(),
        )
      )
        throw new Error(
          "Canvas editing requires current channel membership and management permission.",
        );
      const head = await this.loadCanvas(command.groupId, signal);
      if ((head?.id ?? null) !== command.expectedEventId)
        throw new CommunityCanvasConflictError(head);
      const event = await identity.signEvent({
        kind: COMMUNITY_CANVAS_KIND,
        created_at: Math.max(
          Math.floor(Date.now() / 1_000),
          head ? head.created_at + 1 : 0,
        ),
        tags: [["h", command.groupId]],
        content: command.content,
      });
      const result = await publishWithDuplicateRecovery(
        this.#authority,
        event,
        signal,
      );
      if (!result.accepted)
        throw new Error(result.message || "Relay rejected the canvas");
      this.#emit([event]);
      return [event];
    }
    if (command.type === "direct-message") {
      let prepared = this.#preparedDirect.get(command);
      if (!prepared) {
        const sender = await identity.getPublicKey();
        const recipients = [...new Set(command.recipients)].filter(
          (key) => key !== sender,
        );
        const relayPreferences = await this.#relayPreferences(
          [...recipients, sender],
          signal,
        );
        if (recipients.some((key) => !relayPreferences.urls.get(key)?.length))
          throw new Error("Recipient has not advertised a NIP-17 inbox relay");
        const wraps = await createNip17GiftWraps({
          identity,
          recipients,
          content: command.content,
          createdAt: Math.floor(Date.now() / 1000),
          ...(command.replyToEventId === undefined
            ? {}
            : { replyToEventId: command.replyToEventId }),
          ...(command.eventKind === undefined
            ? {}
            : { eventKind: command.eventKind }),
          ...(command.targetEventId === undefined
            ? {}
            : { targetEventId: command.targetEventId }),
          ...(command.customEmoji === undefined
            ? {}
            : { customEmoji: command.customEmoji }),
        });
        prepared = {
          wraps,
          deliveries: wraps.flatMap((event) => {
            const recipient = event.tags.find((tag) => tag[0] === "p")![1]!;
            return (
              relayPreferences.urls.get(recipient) ?? [this.#scope.relayUrl]
            ).map((relayUrl) => ({
              recipient,
              relayUrl,
              event,
              accepted: false,
            }));
          }),
        };
        this.#preparedDirect.set(command, prepared);
      }
      // Keep every prepared envelope, including the sender recovery copy, for retries.
      await Promise.allSettled(
        prepared.deliveries
          .filter((delivery) => !delivery.accepted)
          .map(async (delivery) => {
            try {
              const result = await publishWithDuplicateRecovery(
                this.#deliveryRelay(delivery.relayUrl),
                delivery.event,
                signal,
              );
              if (!result.accepted)
                throw new Error(
                  result.message || "Relay rejected the direct message",
                );
              delivery.accepted = true;
              delete delivery.error;
            } catch (cause) {
              delivery.error =
                cause instanceof Error ? cause.message : "Delivery failed";
            }
          }),
      );
      this.#emit(
        prepared.wraps.filter((wrap) =>
          prepared.deliveries.some(
            (delivery) => delivery.event.id === wrap.id && delivery.accepted,
          ),
        ),
      );
      const failed = prepared.deliveries.filter(
        (delivery) => !delivery.accepted,
      );
      if (failed.length)
        throw new CommunityDirectDeliveryError(
          prepared.deliveries.map(
            ({ recipient, relayUrl, accepted, error }) => ({
              recipient,
              relayUrl,
              accepted,
              ...(error ? { error } : {}),
            }),
          ),
        );
      return prepared.wraps;
    }

    const currentMetadata =
      command.type === "update-room"
        ? latestVerifiedEvent(
            await this.#queryUnion(
              [this.#authority],
              { kinds: [39_000], "#d": [command.groupId] },
              signal,
            ),
          )
        : undefined;
    const currentMembership =
      command.type === "join" ||
      command.type === "leave" ||
      command.type === "add-member" ||
      command.type === "remove-member"
        ? latestVerifiedEvent(
            await this.#queryUnion(
              [this.#authority],
              { kinds: [39_002], "#d": [command.groupId] },
              signal,
            ),
          )
        : undefined;
    const commandCreatedAt = Math.max(
      Math.floor(Date.now() / 1_000),
      this.#lastCommandCreatedAt + 1,
      (currentMetadata?.created_at ?? 0) + 1,
      (currentMembership?.created_at ?? 0) + 1,
    );
    this.#lastCommandCreatedAt = commandCreatedAt;
    const templates = commandTemplates(
      command,
      commandCreatedAt,
      currentMetadata,
    );
    const events: NostrEvent[] = [];
    for (const template of templates) {
      signal?.throwIfAborted();
      const event =
        command.type === "publish" && command.optimisticEvent !== undefined
          ? command.optimisticEvent
          : await identity.signEvent(template);
      const result = await publishWithDuplicateRecovery(
        this.#authority,
        event,
        signal,
      );
      if (!result.accepted) {
        throw new Error(result.message || "Relay rejected the community event");
      }
      events.push(event);
    }
    if (
      command.type === "create-room" ||
      command.type === "update-room" ||
      command.type === "join"
    ) {
      this.#knownGroupIds.add(command.groupId);
      await this.#subscribeToRooms([command.groupId], signal);
    }
    if (command.type === "delete-room") {
      this.#knownGroupIds.delete(command.groupId);
    }
    this.#emit(events);
    return events;
  }

  async loadGroup(
    request: CommunityGroupLoadRequest,
    signal?: AbortSignal,
  ): Promise<CommunityGroupLoadResult> {
    this.#assertOpen(signal);
    await this.#authenticate(this.#authority, signal);
    const metadata = latestVerifiedEvent(
      await this.#queryUnion(
        [this.#authority],
        { kinds: [39_000], "#d": [request.groupId] },
        signal,
      ),
    );
    if (metadata === undefined) throw new Error("Invite group is unavailable");
    if (
      request.relayPubkey !== undefined &&
      metadata.pubkey !== request.relayPubkey.toLowerCase()
    ) {
      throw new Error("Invite group is not signed by the referenced relay");
    }
    const room = roomScopeFromMetadata(metadata);
    const events = verifiedCommunityEvents(
      await this.#queryUnion(
        [this.#authority],
        { kinds: [...COMMUNITY_STATE_KINDS], "#d": [request.groupId] },
        signal,
      ),
    );
    this.#knownGroupIds.add(request.groupId);
    await this.#subscribeToRooms([request.groupId], signal);
    this.#emit(events);
    return { room, metadata, events };
  }

  async #loadBuzzCapability(signal?: AbortSignal): Promise<void> {
    if (this.#capabilitiesLoaded) return;
    this.#capabilitiesLoaded = true;
    if (!/^wss?:/u.test(this.#scope.relayUrl)) return;
    try {
      const url = this.#scope.relayUrl.replace(/^ws/u, "http");
      const response = await (this.#options.fetch ?? globalThis.fetch)(url, {
        headers: { Accept: "application/nostr+json" },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
          : AbortSignal.timeout(5000),
      });
      if (!response.ok) return;
      const document = (await response.json()) as Record<string, unknown>;
      if (
        document.software === "https://github.com/block/buzz" &&
        typeof document.self === "string" &&
        /^[0-9a-f]{64}$/u.test(document.self)
      ) {
        this.#buzzDirectSupported = true;
        this.#relaySigningPubkey = document.self;
      }
    } catch {
      /* Unsupported or unavailable capability never changes transport. */
    }
  }

  async openBuzzDirectMessage(
    participants: readonly string[],
    signal?: AbortSignal,
  ): Promise<CommunityGroupLoadResult> {
    this.#assertOpen(signal);
    await this.#loadBuzzCapability(signal);
    if (!this.#buzzDirectSupported)
      throw new Error("This relay does not advertise Buzz direct messaging");
    const identity = this.#context.identity;
    if (!identity) throw new Error("Sign in to open a direct message");
    const owner = await identity.getPublicKey();
    const peers = [...new Set(participants)]
      .filter((key) => key !== owner)
      .sort();
    if (
      !peers.length ||
      peers.length > 8 ||
      peers.some((key) => !/^[0-9a-f]{64}$/u.test(key))
    )
      throw new Error("Choose one to eight valid recipients");
    await this.#authenticate(this.#authority, signal);
    const command = await identity.signEvent({
      kind: 41010,
      created_at: Math.floor(Date.now() / 1000),
      tags: peers.map((key) => ["p", key]),
      content: "",
    });
    const result = await this.#authority.publish(command, signal);
    if (!result.accepted)
      throw new Error(result.message || "Relay rejected the DM request");
    let groupId: unknown;
    try {
      groupId = (
        JSON.parse(result.message.replace(/^response:/u, "")) as {
          channel_id?: unknown;
        }
      ).channel_id;
    } catch {
      throw new Error("Relay did not acknowledge a DM channel");
    }
    if (typeof groupId !== "string" || !/^[0-9a-f]{64}$/u.test(groupId))
      throw new Error("Invalid DM channel acknowledgement");
    const group = await this.loadGroup(
      {
        groupId,
        ...(this.#relaySigningPubkey
          ? { relayPubkey: this.#relaySigningPubkey }
          : {}),
      },
      signal,
    );
    const membership = latestVerifiedEvent(
      group.events.filter(
        (event) =>
          event.kind === 39002 && event.pubkey === group.metadata.pubkey,
      ),
    );
    const actual = [
      ...new Set(
        membership?.tags.filter((tag) => tag[0] === "p").map((tag) => tag[1]) ??
          [],
      ),
    ].sort();
    if (
      !isBuzzDirectMetadata(group.metadata) ||
      JSON.stringify(actual) !== JSON.stringify([...peers, owner].sort())
    )
      throw new Error("Relay returned a different DM participant set");
    this.#emit(
      await this.#queryUnion(
        [this.#authority],
        { kinds: [30622], "#p": [owner] },
        signal,
      ),
    );
    return group;
  }

  async hideBuzzDirectMessage(
    groupId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const identity = this.#context.identity;
    if (!identity) throw new Error("Sign in to hide a direct message");
    const group = await this.loadGroup({ groupId }, signal);
    if (!isBuzzDirectMetadata(group.metadata))
      throw new Error("This is not a Buzz direct conversation");
    const result = await this.#authority.publish(
      await identity.signEvent({
        kind: 41012,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["h", groupId]],
        content: "",
      }),
      signal,
    );
    if (!result.accepted)
      throw new Error(result.message || "Relay rejected hiding this DM");
    this.#emit(
      await this.#queryUnion(
        [this.#authority],
        { kinds: [30622], "#p": [await identity.getPublicKey()] },
        signal,
      ),
    );
  }

  async loadCanvas(
    groupId: string,
    signal?: AbortSignal,
  ): Promise<NostrEvent | null> {
    this.#assertOpen(signal);
    await this.#authenticate(this.#authority, signal);
    const group = await this.loadGroup({ groupId }, signal);
    if (
      !canvasReadingAllowed(
        group.events,
        groupId,
        await this.#context.identity?.getPublicKey(),
      )
    )
      throw new Error("Canvas is unavailable without current channel access");
    return latestChannelCanvas(
      await this.#queryUnion(
        [this.#authority],
        { kinds: [COMMUNITY_CANVAS_KIND], "#h": [groupId] },
        signal,
      ),
      groupId,
    );
  }

  async search(
    query: string,
    signal?: AbortSignal,
  ): Promise<readonly CommunitySearchResult[]> {
    this.#assertOpen(signal);
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized === "") return [];
    const groupIds = [...this.#knownGroupIds];
    if (groupIds.length === 0) return [];
    const [content, profiles] = await Promise.all([
      this.#queryUnion(
        this.#relays,
        {
          kinds: [9, 11, 1_111],
          "#h": groupIds,
          search: query,
          limit: this.#options.searchLimit ?? 100,
        },
        signal,
      ),
      this.#queryUnion(
        this.#relays,
        {
          kinds: [0],
          search: query,
          limit: this.#options.searchLimit ?? 100,
        },
        signal,
      ),
    ]);
    const events = distinctEvents([...content, ...profiles]);
    return events
      .filter(
        (event) =>
          !isRegistryControlEvent(event) &&
          event.content.toLocaleLowerCase().includes(normalized),
      )
      .map((event) => ({ event, relayUrl: this.#scope.relayUrl }));
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#subscriptionAbort.abort();
    this.#registrationReads.clear();
    this.#targetSubscriptionKeys.clear();
    this.presence?.close();
    for (const subscription of this.#subscriptions) subscription.close();
    this.#subscriptions.clear();
    this.#roomSubscriptionIds.clear();
    this.#knownGroupIds.clear();
    this.#listeners.clear();
    for (const relay of this.#relays) relay.close();
    for (const relay of this.#deliveryRelays.values()) relay.close();
    this.#deliveryRelays.clear();
  }

  async #queryUnion(
    relays: readonly CommunityRelay[],
    filter: RelayFilter,
    signal?: AbortSignal,
    requireAll = false,
  ): Promise<NostrEvent[]> {
    signal?.throwIfAborted();
    const settled = await Promise.allSettled(
      relays.map(async (relay) => relay.query(filter, signal)),
    );
    signal?.throwIfAborted();
    const successful = settled.filter(
      (result): result is PromiseFulfilledResult<NostrEvent[]> =>
        result.status === "fulfilled",
    );
    if (
      successful.length === 0 ||
      (requireAll && successful.length !== relays.length)
    ) {
      const messages = settled
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        )
        .map((result) =>
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        );
      throw new Error(
        `${successful.length ? "Incomplete community relay coverage" : "No configured community relay answered"}: ${messages.join("; ")}`,
      );
    }
    const events = distinctEvents(successful.flatMap((result) => result.value));
    return filter.limit === undefined
      ? events
      : filter.limit <= 0
        ? []
        : events.slice(-filter.limit);
  }

  async #authenticate(
    relay: CommunityRelay,
    signal?: AbortSignal,
  ): Promise<void> {
    if (
      this.#authenticated.has(relay) ||
      relay.authenticate === undefined ||
      this.#context.identity === undefined
    ) {
      return;
    }
    const identity = this.#context.identity;
    await authenticateRegistryRelay(relay, identity, signal);
    this.#authenticated.add(relay);
  }

  async #registerLive(
    relay: CommunityRelay,
    filter: RelayFilter,
  ): Promise<void> {
    const key = JSON.stringify([relay.url, filter]);
    const existing = this.#registrationReads.get(key);
    if (existing) return existing;
    const request = Promise.resolve()
      .then(async () => {
        let closed = false;
        const subscription = await relay.subscribe(
          filter,
          {
            onevent: (event) => this.#emit([event]),
            onclose: () => {
              closed = true;
              this.#registrationReads.delete(key);
            },
          },
          this.#subscriptionAbort.signal,
        );
        if (closed || this.#closed) {
          subscription.close();
          this.#registrationReads.delete(key);
          return;
        }
        this.#subscriptions.add(subscription);
      })
      .catch((cause: unknown) => {
        this.#registrationReads.delete(key);
        throw cause;
      });
    this.#registrationReads.set(key, request);
    return request;
  }

  async #subscribeToTargets(
    targetIds: readonly string[],
    _signal?: AbortSignal,
  ): Promise<void> {
    if (this.#listeners.size === 0) return;
    for (const ids of chunks([...new Set(targetIds)].sort(), 500)) {
      if (ids.length === 0) continue;
      await Promise.all(
        this.#relays.map((relay) =>
          this.#registerLive(relay, {
            kinds: [5, 7, 9_005, 40_003],
            "#e": ids,
            limit: 0,
          }),
        ),
      );
    }
  }

  async #subscribeToRooms(
    groupIds: readonly string[],
    _signal?: AbortSignal,
  ): Promise<void> {
    if (this.#listeners.size === 0) return;
    for (const groupId of [...new Set(groupIds)]) {
      if (groupId === "") continue;
      await Promise.all([
        ...this.#relays.map((relay) =>
          this.#registerLive(relay, {
            kinds: [9, 11, 1_111],
            "#h": [groupId],
            limit: 0,
          }),
        ),
        this.#registerLive(this.#authority, {
          kinds: this.#scope.discoverPublicRooms
            ? [39_001, 39_002, 39_003]
            : [...COMMUNITY_STATE_KINDS],
          "#d": [groupId],
        }),
        this.#registerLive(this.#authority, {
          kinds: [...COMMUNITY_CHANNEL_ACTIVITY_KINDS, COMMUNITY_CANVAS_KIND],
          "#h": [groupId],
          limit: 0,
        }),
      ]);
      this.#knownGroupIds.add(groupId);
    }
  }

  async #subscribeToProfiles(
    authors: readonly string[],
    _signal?: AbortSignal,
  ): Promise<void> {
    if (authors.length === 0) return;
    await Promise.all(
      this.#relays.map((relay) =>
        this.#registerLive(relay, {
          kinds: [0, 30_030, 30_315],
          authors: [...new Set(authors)].sort(),
          limit: 0,
        }),
      ),
    );
  }

  async loadDirectHistory(
    signal?: AbortSignal,
    before = this.#privateCursor,
  ): Promise<CommunitySnapshot> {
    this.#assertOpen(signal);
    const identity = this.#context.identity;
    if (!identity) throw new Error("Sign in to load direct messages");
    const pubkey = await identity.getPublicKey();
    const preferences = await this.#relayPreferences([pubkey], signal);
    const page = await this.#loadPrivateEvents(
      preferences.urls.get(pubkey) ?? [],
      signal,
      before,
    );
    return {
      encryptedPage: this.#encryptedPage(
        pubkey,
        preferences.urls.get(pubkey) ?? [],
        page,
        before,
      ),
      events: [],
      encryptedEvents: page.wraps,
      privateEvents: page.events,
      hasOlderDirectMessages: page.hasOlder,
      capabilities: this.#capabilities(),
    };
  }

  #encryptedPage(
    pubkey: string,
    relayUrls: readonly string[],
    result: {
      wraps: NostrEvent[];
      hasOlder: boolean;
      coverageGaps?: CommunityContentWindow["coverageGaps"];
      cursor?: CommunityContentWindowRequest["before"];
    },
    before?: CommunityContentWindowRequest["before"],
    after?: CommunityContentWindowRequest["after"],
  ) {
    const oldest = result.wraps[0];
    return {
      request: {
        collection: "room-history" as const,
        groupId: pubkey,
        limit: 100,
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
      },
      window: {
        events: result.wraps,
        primaryEventIds: result.wraps.map((event) => event.id),
        hasOlder: result.hasOlder,
        ...(result.coverageGaps?.length
          ? { coverageGaps: result.coverageGaps }
          : {}),
        ...(result.cursor
          ? { olderCursor: result.cursor }
          : oldest
            ? {
                olderCursor: {
                  createdAt: oldest.created_at,
                  eventId: oldest.id,
                },
              }
            : {}),
      },
      relayUrls: relayUrls.length
        ? relayUrls
        : this.#relays.map((relay) => relay.url),
    };
  }

  async #loadPrivateEvents(
    relayUrls: readonly string[],
    signal?: AbortSignal,
    before?: import("./contracts.js").CommunityContentCursor,
    after?: import("./contracts.js").CommunityContentCursor,
  ): Promise<{
    wraps: NostrEvent[];
    events: CommunityPrivateEvent[];
    hasOlder: boolean;
    coverageGaps?: CommunityContentWindow["coverageGaps"];
    cursor?: CommunityContentWindowRequest["before"];
  }> {
    const identity = this.#context.identity;
    if (identity?.nip44 === undefined)
      return { wraps: [], events: [], hasOlder: false };
    const pubkey = await identity.getPublicKey();
    const inboxRelays = relayUrls.map((url) => this.#deliveryRelay(url));
    const page = await this.#queryRawContentPage(
      {
        kinds: [1059],
        "#p": [pubkey],
        ...(after ? { since: after.createdAt } : {}),
      },
      before,
      100,
      signal,
      inboxRelays.length ? inboxRelays : this.#relays,
    );
    for (const gap of page.coverageGaps)
      this.#privateCoverageGaps.set(gap.createdAt, gap);
    const wraps = page.events;
    const oldest = wraps[0];
    this.#privateCursor =
      page.cursor ??
      (oldest ? { createdAt: oldest.created_at, eventId: oldest.id } : before);
    const settled: PromiseSettledResult<CommunityPrivateEvent>[] = [];
    for (let offset = 0; offset < wraps.length; offset += 16) {
      if (offset) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      signal?.throwIfAborted();
      settled.push(
        ...(await Promise.allSettled(
          wraps
            .slice(offset, offset + 16)
            .map((wrap) => unwrapNip17GiftWrap(identity, wrap)),
        )),
      );
    }
    const events = [
      ...new Map(
        settled
          .filter(
            (result): result is PromiseFulfilledResult<CommunityPrivateEvent> =>
              result.status === "fulfilled",
          )
          .map((result) => [result.value.id, result.value] as const),
      ).values(),
    ].toSorted(
      (left, right) =>
        left.created_at - right.created_at || left.id.localeCompare(right.id),
    );
    return {
      wraps,
      events,
      hasOlder: page.hasOlder,
      coverageGaps: [...this.#privateCoverageGaps.values()],
      ...(page.cursor ? { cursor: page.cursor } : {}),
    };
  }

  async #relayPreferences(
    pubkeys: readonly string[],
    signal?: AbortSignal,
  ): Promise<{ events: NostrEvent[]; urls: Map<string, string[]> }> {
    if (pubkeys.length === 0) return { events: [], urls: new Map() };
    const events = await this.#queryUnion(
      this.#relays,
      { kinds: [10_050], authors: [...new Set(pubkeys)], limit: 500 },
      signal,
    );
    const latest = new Map<string, NostrEvent>();
    for (const event of events) {
      const current = latest.get(event.pubkey);
      if (
        current === undefined ||
        event.created_at > current.created_at ||
        (event.created_at === current.created_at && event.id < current.id)
      ) {
        latest.set(event.pubkey, event);
      }
    }
    const urls = new Map<string, string[]>();
    for (const [pubkey, event] of latest) {
      const values = event.tags
        .filter((tag) => tag[0] === "relay" && tag[1] !== undefined)
        .map((tag) => tag[1]!)
        .flatMap((url) => {
          try {
            return [normalizeRelayUrl(url)];
          } catch {
            return [];
          }
        });
      if (values.length > 0) urls.set(pubkey, [...new Set(values)]);
    }
    return { events, urls };
  }

  async #subscribeToInbox(
    relayUrls: readonly string[],
    pubkey: string | undefined,
    signal?: AbortSignal,
  ): Promise<void> {
    if (pubkey === undefined || this.#listeners.size === 0) return;
    if (
      this.#buzzDirectSupported &&
      !this.#targetSubscriptionKeys.has("buzz-visibility")
    ) {
      const subscription = await this.#authority.subscribe(
        { kinds: [30622], "#p": [pubkey] },
        { onevent: (event) => this.#emit([event]) },
        signal,
      );
      this.#subscriptions.add(subscription);
      this.#targetSubscriptionKeys.add("buzz-visibility");
    }
    for (const url of relayUrls.length ? relayUrls : [this.#scope.relayUrl]) {
      await this.#registerLive(this.#deliveryRelay(url), {
        kinds: [1059],
        "#p": [pubkey],
        limit: 0,
      });
    }
  }

  #deliveryRelay(url: string): CommunityRelay {
    const normalized = normalizeRelayUrl(url);
    const configured = this.#relays.find((relay) => relay.url === normalized);
    if (configured !== undefined) return configured;
    const current = this.#deliveryRelays.get(normalized);
    if (current !== undefined) return current;
    const relay = this.#options.relayFactory.create(normalized);
    this.#deliveryRelays.set(normalized, relay);
    return relay;
  }

  #emit(events: readonly NostrEvent[]): void {
    if (this.#closed || events.length === 0) return;
    for (const listener of this.#listeners) listener(events);
  }

  #assertOpen(signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (this.#closed) throw new Error("Community session is closed");
  }

  #capabilities(): CommunityCapabilities {
    const signedIn = this.#context.identity !== undefined;
    return {
      channels: true,
      forums: true,
      directMessages: this.#context.identity?.nip44 !== undefined,
      buzzDirectMessages: this.#buzzDirectSupported,
      search: true,
      manageGroup: signedIn,
      manageMembers: signedIn,
      deleteEvents: signedIn,
      archive: false,
      editMessages: signedIn,
      pulse: true,
      memberRoles: true,
      writeRestrictedRooms: true,
      groupInvites: true,
    };
  }
}

async function publishWithDuplicateRecovery(
  relay: CommunityRelay,
  event: NostrEvent,
  signal?: AbortSignal,
): Promise<{ accepted: boolean; message: string }> {
  try {
    const result = await relay.publish(event, signal);
    if (!result.accepted && isDuplicateRelayReason(result.message)) {
      return { accepted: true, message: result.message };
    }
    return result;
  } catch (cause) {
    if (cause instanceof Error && isDuplicateRelayReason(cause.message)) {
      return { accepted: true, message: cause.message };
    }
    throw cause;
  }
}

function isDuplicateRelayReason(message: string): boolean {
  return /(?:^|\s)duplicate:/iu.test(message);
}

function commandTemplates(
  command: CommunityCommand,
  createdAt: number,
  currentMetadata?: NostrEvent,
): readonly NostrEventTemplate[] {
  if (command.type === "direct-message" || command.type === "save-canvas")
    return [];
  if (command.type === "publish") return [command.template];
  if (command.type === "create-room" || command.type === "update-room") {
    const metadataContent = parseMetadataContent(currentMetadata?.content);
    const writerRestricted =
      command.update.postingPolicy === undefined
        ? currentMetadata?.tags.some((tag) => tag[0] === "write-restricted") ===
            true || metadataContent["write-restricted"] === true
        : command.update.postingPolicy === "writers";
    const content = {
      ...metadataContent,
      name: command.update.name.trim(),
      about: command.update.description.trim(),
      private: command.update.visibility === "private",
      "write-restricted": writerRestricted,
    };
    const preservedTags =
      command.type === "update-room"
        ? (currentMetadata?.tags ?? []).filter(
            (tag) =>
              ![
                "d",
                "h",
                "name",
                "about",
                "private",
                "write-restricted",
                "member_count",
              ].includes(tag[0] ?? ""),
          )
        : [];
    return [
      {
        kind: command.type === "create-room" ? 9_007 : 9_002,
        created_at: createdAt,
        content: JSON.stringify(content),
        tags: [
          ["h", command.groupId],
          ["name", command.update.name.trim()],
          ["about", command.update.description.trim()],
          ...preservedTags,
          ...(command.type === "create-room"
            ? [
                [
                  "supported_kinds",
                  ...(command.roomKind === "forum"
                    ? ["11", "1111", "7"]
                    : ["9", "7"]),
                ],
              ]
            : []),
          ...(command.update.visibility === "private" ? [["private"]] : []),
          ...(writerRestricted ? [["write-restricted"]] : []),
        ],
      },
    ];
  }
  if (command.type === "delete-room") {
    return [
      {
        kind: 9_008,
        created_at: createdAt,
        content: "",
        tags: [["h", command.groupId]],
      },
    ];
  }
  if (command.type === "delete") {
    return [
      {
        kind: command.mode === "moderator" ? 9_005 : 5,
        created_at: createdAt,
        content: "",
        tags: [
          ["e", command.eventId],
          ["h", command.groupId],
        ],
      },
    ];
  }
  if (command.type === "join" || command.type === "leave") {
    return [
      {
        kind: command.type === "join" ? 9_021 : 9_022,
        created_at: createdAt,
        content: "",
        tags: [
          ["h", command.groupId],
          ...(command.type === "join" && command.code !== undefined
            ? [["code", command.code]]
            : []),
        ],
      },
    ];
  }
  if (command.type === "add-member") {
    return [
      {
        kind: 9_000,
        created_at: createdAt,
        content: "",
        tags: [
          ["h", command.groupId],
          ["p", command.pubkey, ...(command.roles ?? [])],
        ],
      },
    ];
  }
  if (command.type === "create-invite") {
    return [
      {
        kind: 9_009,
        created_at: createdAt,
        content: "",
        tags: [
          ["h", command.groupId],
          ["code", command.code],
        ],
      },
    ];
  }
  return [
    {
      kind: 9_001,
      created_at: createdAt,
      content: "",
      tags: [
        ["h", command.groupId],
        ["p", command.pubkey],
      ],
    },
  ];
}

function latestVerifiedEvent(
  events: readonly NostrEvent[],
): NostrEvent | undefined {
  return verifiedCommunityEvents(events)
    .toSorted(
      (left, right) =>
        left.created_at - right.created_at || left.id.localeCompare(right.id),
    )
    .at(-1);
}

function verifiedCommunityEvents(events: readonly NostrEvent[]): NostrEvent[] {
  return events.flatMap((event) => verifiedNostrEvent(event) ?? []);
}

function parseMetadataContent(
  value: string | undefined,
): Record<string, unknown> {
  if (value === undefined || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null &&
      !Array.isArray(parsed) &&
      typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function roomScopeFromMetadata(metadata: NostrEvent): CommunityRoomScope {
  const groupId = metadata.tags.find((tag) => tag[0] === "d")?.[1];
  if (groupId === undefined || groupId === "") {
    throw new Error("Invite group metadata is missing its group ID");
  }
  const supportedKinds = new Set(
    metadata.tags
      .filter((tag) => tag[0] === "supported_kinds")
      .flatMap((tag) => tag.slice(1))
      .map(Number),
  );
  const compatibilityKind = metadata.tags.find(
    (tag) => tag[0] === "channel_type",
  )?.[1];
  const kind =
    supportedKinds.has(11) ||
    supportedKinds.has(1_111) ||
    compatibilityKind === "forum"
      ? "forum"
      : supportedKinds.has(9) ||
          compatibilityKind === "stream" ||
          compatibilityKind === "dm"
        ? "channel"
        : undefined;
  if (kind === undefined)
    throw new Error("Invite does not reference a supported room");
  const content = parseMetadataContent(metadata.content);
  const name =
    metadata.tags.find((tag) => tag[0] === "name")?.[1]?.trim() ||
    (typeof content.name === "string" ? content.name.trim() : "") ||
    groupId;
  const description =
    metadata.tags.find((tag) => tag[0] === "about")?.[1]?.trim() ||
    (typeof content.about === "string" ? content.about.trim() : "");
  return {
    id: groupId,
    groupId,
    name,
    kind,
    ...(isBuzzDirectMetadata(metadata)
      ? { transport: "buzz-dm" as const }
      : {}),
    ...(description === "" ? {} : { description }),
    private:
      metadata.tags.some((tag) => tag[0] === "private") ||
      content.private === true,
  };
}

function distinctRelayUrls(scope: CommunityScope): string[] {
  return [scope.relayUrl, ...(scope.readRelayUrls ?? [])]
    .map(normalizeRelayUrl)
    .filter((url, index, urls) => urls.indexOf(url) === index);
}

function normalizeRelayUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "ws:" &&
    url.protocol !== "wss:" &&
    url.protocol !== "memory:"
  ) {
    throw new Error(`Unsupported community relay protocol: ${url.protocol}`);
  }
  return url.toString();
}

function contentWindowFilter(
  request: CommunityContentWindowRequest,
): RelayFilter {
  const context = { "#h": [request.groupId] };
  switch (request.collection) {
    case "channel-roots":
      return { kinds: [9], ...context };
    case "forum-topics":
      return { kinds: [11], ...context };
    case "thread":
      return {
        kinds: [9, 1_111],
        ...context,
        "#e": [request.rootEventId!],
      };
    case "room-history":
      return { kinds: [...COMMUNITY_CONTENT_KINDS], ...context };
  }
}

function contentWindowPrimary(
  event: NostrEvent,
  collection: CommunityContentWindowRequest["collection"],
): boolean {
  if (collection === "channel-roots") {
    return (
      COMMUNITY_CHANNEL_ACTIVITY_KINDS.some((kind) => kind === event.kind) ||
      (event.kind === 9 &&
        !event.tags.some((tag) => tag[0] === "e" || tag[0] === "E"))
    );
  }
  if (collection === "forum-topics") return event.kind === 11;
  if (collection === "thread") {
    return event.kind === 9 || event.kind === 1_111;
  }
  return (
    COMMUNITY_CONTENT_KINDS.some((kind) => kind === event.kind) ||
    COMMUNITY_CHANNEL_ACTIVITY_KINDS.some((kind) => kind === event.kind)
  );
}

function distinctEvents(events: readonly NostrEvent[]): NostrEvent[] {
  return [
    ...new Map(events.map((event) => [event.id, event] as const)).values(),
  ].toSorted(
    (left, right) =>
      left.created_at - right.created_at || left.id.localeCompare(right.id),
  );
}

function verifiedPulseEvents(events: readonly NostrEvent[]): NostrEvent[] {
  return events.flatMap((event) => verifiedNostrEvent(event) ?? []);
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    output.push(items.slice(offset, offset + size));
  }
  return output;
}

function synchronizationSince(
  request: CommunitySynchronizationRequest | undefined,
): number | undefined {
  const checkpoints =
    request?.plan.checkpoints.filter(
      (checkpoint) => checkpoint.stream === "content",
    ) ?? [];
  if (checkpoints.length === 0) return undefined;
  return Math.max(
    0,
    Math.min(...checkpoints.map((checkpoint) => checkpoint.createdAt)) - 1,
  );
}

export class CommunityDirectDeliveryError extends Error {
  constructor(
    readonly deliveries: readonly {
      recipient: string;
      relayUrl: string;
      accepted: boolean;
      error?: string;
    }[],
  ) {
    super(
      `Direct message partially delivered: ${deliveries.filter((delivery) => !delivery.accepted).length} of ${deliveries.length} relay deliveries pending. Retry resumes the original message.`,
    );
    this.name = "CommunityDirectDeliveryError";
  }
}
