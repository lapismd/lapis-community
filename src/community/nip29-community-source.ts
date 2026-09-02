import type {
  CommunityRelay,
  CommunityRelayFactory,
  CommunityRelaySubscription,
  RelayFilter,
} from "../nostr/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

import { communityRooms } from "./materialize.js";
import { createNip17GiftWraps, unwrapNip17GiftWrap } from "./nip17.js";
import type {
  CommunityCapabilities,
  CommunityCommand,
  CommunityDataSource,
  CommunityDataSourceContext,
  CommunityPrivateEvent,
  CommunityScope,
  CommunitySearchResult,
  CommunitySession,
  CommunitySessionSubscription,
  CommunitySnapshot,
} from "./contracts.js";

export interface Nip29CommunitySourceOptions {
  relayFactory: CommunityRelayFactory;
  searchLimit?: number;
}

const COMMUNITY_CONTENT_KINDS = [5, 7, 9, 11, 1_111, 9_005] as const;
const COMMUNITY_STATE_KINDS = [39_000, 39_001, 39_002] as const;
const PUBLIC_ROOM_DISCOVERY_LIMIT = 1_000;

export function createNip29CommunitySource(
  options: Nip29CommunitySourceOptions,
): CommunityDataSource {
  return {
    async open(scope, context = {}, signal) {
      signal?.throwIfAborted();
      return new Nip29CommunitySession(scope, context, options);
    },
  };
}

class Nip29CommunitySession implements CommunitySession {
  readonly #scope: CommunityScope;
  readonly #context: CommunityDataSourceContext;
  readonly #options: Nip29CommunitySourceOptions;
  readonly #relays: CommunityRelay[];
  readonly #authority: CommunityRelay;
  readonly #subscriptions = new Set<CommunityRelaySubscription>();
  readonly #listeners = new Set<(events: readonly NostrEvent[]) => void>();
  readonly #authenticated = new WeakSet<CommunityRelay>();
  readonly #deliveryRelays = new Map<string, CommunityRelay>();
  #closed = false;
  #baseSubscriptionsStarted = false;
  #knownGroupIds = new Set<string>();
  #roomSubscriptionIds = new Set<string>();
  #targetSubscriptionKeys = new Set<string>();

  constructor(
    scope: CommunityScope,
    context: CommunityDataSourceContext,
    options: Nip29CommunitySourceOptions,
  ) {
    this.#scope = scope;
    this.#context = context;
    this.#options = options;
    const urls = distinctRelayUrls(scope);
    this.#relays = urls.map((url) => options.relayFactory.create(url));
    const authorityUrl = normalizeRelayUrl(scope.relayUrl);
    this.#authority =
      this.#relays.find((relay) => relay.url === authorityUrl) ??
      options.relayFactory.create(authorityUrl);
    for (const room of communityRooms(scope)) {
      this.#knownGroupIds.add(room.groupId);
    }
  }

  async snapshot(signal?: AbortSignal): Promise<CommunitySnapshot> {
    this.#assertOpen(signal);
    await Promise.all(
      this.#relays.map(async (relay) => this.#authenticate(relay, signal)),
    );
    const discoveredMetadata = this.#scope.discoverPublicRooms
      ? await this.#queryUnion(
          [this.#authority],
          { kinds: [39_000], limit: PUBLIC_ROOM_DISCOVERY_LIMIT },
          signal,
        )
      : [];
    const rooms = communityRooms(this.#scope, discoveredMetadata);
    const groupIds = [
      ...new Set([
        ...rooms.map((room) => room.groupId),
        ...this.#knownGroupIds,
      ]),
    ];
    for (const groupId of groupIds) this.#knownGroupIds.add(groupId);
    if (groupIds.length === 0) {
      return {
        events: discoveredMetadata,
        capabilities: this.#capabilities(),
      };
    }
    await this.#subscribeToRooms(groupIds, signal);

    const content = await this.#queryUnion(
      this.#relays,
      { kinds: [...COMMUNITY_CONTENT_KINDS], "#h": groupIds },
      signal,
    );
    const state = await this.#queryUnion(
      [this.#authority],
      { kinds: [...COMMUNITY_STATE_KINDS], "#d": groupIds },
      signal,
    );
    const targets = [...content, ...state].map((event) => event.id);
    const referenced =
      targets.length === 0
        ? []
        : await this.#queryUnion(
            this.#relays,
            { kinds: [5, 7, 9_005], "#e": targets },
            signal,
          );
    const identityPubkey = await this.#context.identity?.getPublicKey();
    const authors = [
      ...new Set(
        [...content, ...state, ...referenced]
          .map((event) => event.pubkey)
          .concat(
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
            { kinds: [0, 30_030], authors },
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
    const privateEvents = await this.#loadPrivateEvents(inboxUrls, signal);
    await this.#subscribeToTargets(targets, signal);
    return {
      events: distinctEvents([
        ...discoveredMetadata,
        ...content,
        ...state,
        ...referenced,
        ...profiles,
        ...relayPreferences.events,
      ]),
      ...(privateEvents.length === 0 ? {} : { privateEvents }),
      capabilities: this.#capabilities(),
    };
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
          this.#relays.map(async (relay) => {
            const subscription = await relay.subscribe(
              { kinds: [1_059], "#p": [identityPubkey] },
              { onevent: (event) => this.#emit([event]) },
              signal,
            );
            this.#subscriptions.add(subscription);
          }),
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
    if (command.type === "direct-message") {
      const sender = await identity.getPublicKey();
      const deliveries = [...new Set([...command.recipients, sender])];
      const relayPreferences = await this.#relayPreferences(deliveries, signal);
      const missing = command.recipients.filter(
        (pubkey) => (relayPreferences.urls.get(pubkey)?.length ?? 0) === 0,
      );
      if (missing.length > 0) {
        throw new Error(
          `${missing.length === 1 ? "Recipient has" : "Recipients have"} not advertised a NIP-17 inbox relay`,
        );
      }
      const wraps = await createNip17GiftWraps({
        identity,
        recipients: command.recipients,
        content: command.content,
        createdAt: Math.floor(Date.now() / 1_000),
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
      for (const wrap of wraps) {
        const recipient = wrap.tags.find((tag) => tag[0] === "p")?.[1];
        if (recipient === undefined) continue;
        const urls = relayPreferences.urls.get(recipient) ?? [
          this.#scope.relayUrl,
        ];
        for (const url of urls) {
          const result = await this.#deliveryRelay(url).publish(wrap, signal);
          if (!result.accepted) {
            throw new Error(
              result.message || "Relay rejected the direct message",
            );
          }
        }
      }
      this.#emit(wraps);
      return wraps;
    }
    const templates = commandTemplates(command, Math.floor(Date.now() / 1_000));
    const events: NostrEvent[] = [];
    for (const template of templates) {
      signal?.throwIfAborted();
      const event =
        command.type === "publish" && command.optimisticEvent !== undefined
          ? command.optimisticEvent
          : await identity.signEvent(template);
      const result = await this.#authority.publish(event, signal);
      if (!result.accepted) {
        throw new Error(result.message || "Relay rejected the community event");
      }
      events.push(event);
    }
    if (command.type === "create-room" || command.type === "update-room") {
      this.#knownGroupIds.add(command.groupId);
      await this.#subscribeToRooms([command.groupId], signal);
    }
    if (command.type === "delete-room") {
      this.#knownGroupIds.delete(command.groupId);
    }
    this.#emit(events);
    return events;
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
      .filter((event) => event.content.toLocaleLowerCase().includes(normalized))
      .map((event) => ({ event, relayUrl: this.#scope.relayUrl }));
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
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
    if (successful.length === 0) {
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
        `No configured community relay answered: ${messages.join("; ")}`,
      );
    }
    return distinctEvents(successful.flatMap((result) => result.value));
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
    await relay.authenticate(
      async (template) => identity.signEvent(template),
      signal,
    );
    this.#authenticated.add(relay);
  }

  async #subscribeToTargets(
    targetIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.#listeners.size === 0) return;
    for (const ids of chunks([...new Set(targetIds)], 500)) {
      const key = ids.toSorted().join(":");
      if (ids.length === 0 || this.#targetSubscriptionKeys.has(key)) continue;
      this.#targetSubscriptionKeys.add(key);
      await Promise.all(
        this.#relays.map(async (relay) => {
          const subscription = await relay.subscribe(
            { kinds: [5, 7, 9_005], "#e": ids },
            { onevent: (event) => this.#emit([event]) },
            signal,
          );
          this.#subscriptions.add(subscription);
        }),
      );
    }
  }

  async #subscribeToRooms(
    groupIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (this.#listeners.size === 0) return;
    for (const groupId of [...new Set(groupIds)]) {
      if (groupId === "" || this.#roomSubscriptionIds.has(groupId)) continue;
      const subscriptions = await Promise.all([
        ...this.#relays.map(async (relay) =>
          relay.subscribe(
            { kinds: [9, 11, 1_111], "#h": [groupId] },
            { onevent: (event) => this.#emit([event]) },
            signal,
          ),
        ),
        this.#authority.subscribe(
          {
            kinds: this.#scope.discoverPublicRooms
              ? [39_001, 39_002]
              : [...COMMUNITY_STATE_KINDS],
            "#d": [groupId],
          },
          { onevent: (event) => this.#emit([event]) },
          signal,
        ),
      ]);
      for (const subscription of subscriptions) {
        this.#subscriptions.add(subscription);
      }
      this.#roomSubscriptionIds.add(groupId);
      this.#knownGroupIds.add(groupId);
    }
  }

  async #subscribeToProfiles(
    authors: readonly string[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (authors.length === 0) return;
    const key = `profiles:${[...authors].toSorted().join(",")}`;
    if (this.#targetSubscriptionKeys.has(key)) return;
    this.#targetSubscriptionKeys.add(key);
    await Promise.all(
      this.#relays.map(async (relay) => {
        const subscription = await relay.subscribe(
          { kinds: [0, 30_030], authors: [...authors] },
          { onevent: (event) => this.#emit([event]) },
          signal,
        );
        this.#subscriptions.add(subscription);
      }),
    );
  }

  async #loadPrivateEvents(
    relayUrls: readonly string[],
    signal?: AbortSignal,
  ): Promise<CommunityPrivateEvent[]> {
    const identity = this.#context.identity;
    if (identity?.nip44 === undefined) return [];
    const pubkey = await identity.getPublicKey();
    const inboxRelays = relayUrls.map((url) => this.#deliveryRelay(url));
    const wraps = await this.#queryUnion(
      inboxRelays.length === 0 ? this.#relays : inboxRelays,
      { kinds: [1_059], "#p": [pubkey], limit: 500 },
      signal,
    );
    const settled = await Promise.allSettled(
      wraps.map(async (wrap) => unwrapNip17GiftWrap(identity, wrap)),
    );
    return [
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
        (event.created_at === current.created_at && event.id > current.id)
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
    for (const url of relayUrls) {
      const key = `inbox:${url}:${pubkey}`;
      if (this.#targetSubscriptionKeys.has(key)) continue;
      this.#targetSubscriptionKeys.add(key);
      const subscription = await this.#deliveryRelay(url).subscribe(
        { kinds: [1_059], "#p": [pubkey] },
        { onevent: (event) => this.#emit([event]) },
        signal,
      );
      this.#subscriptions.add(subscription);
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
      search: true,
      manageGroup: signedIn,
      manageMembers: signedIn,
      deleteEvents: signedIn,
      archive: false,
      editMessages: false,
    };
  }
}

function commandTemplates(
  command: CommunityCommand,
  createdAt: number,
): readonly NostrEventTemplate[] {
  if (command.type === "direct-message") return [];
  if (command.type === "publish") return [command.template];
  if (command.type === "create-room" || command.type === "update-room") {
    return [
      {
        kind: command.type === "create-room" ? 9_007 : 9_002,
        created_at: createdAt,
        content: JSON.stringify({
          name: command.update.name.trim(),
          about: command.update.description.trim(),
        }),
        tags: [
          ["h", command.groupId],
          ["name", command.update.name.trim()],
          ["about", command.update.description.trim()],
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
        tags: [["h", command.groupId]],
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

function distinctEvents(events: readonly NostrEvent[]): NostrEvent[] {
  return [
    ...new Map(events.map((event) => [event.id, event] as const)).values(),
  ].toSorted(
    (left, right) =>
      left.created_at - right.created_at || left.id.localeCompare(right.id),
  );
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    output.push(items.slice(offset, offset + size));
  }
  return output;
}
