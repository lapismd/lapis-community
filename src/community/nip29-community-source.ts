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
  #closed = false;
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
  }

  async snapshot(signal?: AbortSignal): Promise<CommunitySnapshot> {
    this.#assertOpen(signal);
    const rooms = communityRooms(this.#scope);
    const groupIds = rooms.map((room) => room.groupId);
    if (groupIds.length === 0) {
      return { events: [], capabilities: this.#capabilities() };
    }
    await Promise.all(
      this.#relays.map(async (relay) => this.#authenticate(relay, signal)),
    );

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
    const privateEvents = await this.#loadPrivateEvents(signal);
    await this.#subscribeToTargets(targets, signal);
    return {
      events: distinctEvents([
        ...content,
        ...state,
        ...referenced,
        ...profiles,
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
    if (groupIds.length > 0 && this.#subscriptions.size === 0) {
      await Promise.all(
        this.#relays.map(async (relay) => this.#authenticate(relay, signal)),
      );
      await Promise.all(
        this.#relays.map(async (relay) => {
          const subscription = await relay.subscribe(
            { kinds: [9, 11, 1_111], "#h": groupIds },
            { onevent: (event) => this.#emit([event]) },
            signal,
          );
          this.#subscriptions.add(subscription);
        }),
      );
      const stateSubscription = await this.#authority.subscribe(
        { kinds: [...COMMUNITY_STATE_KINDS], "#d": groupIds },
        { onevent: (event) => this.#emit([event]) },
        signal,
      );
      this.#subscriptions.add(stateSubscription);
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
      const wraps = await createNip17GiftWraps({
        identity,
        recipients: command.recipients,
        content: command.content,
        createdAt: Math.floor(Date.now() / 1_000),
        ...(command.replyToEventId === undefined
          ? {}
          : { replyToEventId: command.replyToEventId }),
      });
      for (const wrap of wraps) {
        const result = await this.#authority.publish(wrap, signal);
        if (!result.accepted) {
          throw new Error(
            result.message || "Relay rejected the direct message",
          );
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
    const groupIds = communityRooms(this.#scope).map((room) => room.groupId);
    if (groupIds.length === 0) return [];
    const events = await this.#queryUnion(
      this.#relays,
      {
        kinds: [9, 11, 1_111],
        "#h": groupIds,
        search: query,
        limit: this.#options.searchLimit ?? 100,
      },
      signal,
    );
    return events
      .filter((event) => event.content.toLocaleLowerCase().includes(normalized))
      .map((event) => ({ event, relayUrl: this.#scope.relayUrl }));
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const subscription of this.#subscriptions) subscription.close();
    this.#subscriptions.clear();
    this.#listeners.clear();
    for (const relay of this.#relays) relay.close();
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
    signal?: AbortSignal,
  ): Promise<CommunityPrivateEvent[]> {
    const identity = this.#context.identity;
    if (identity?.nip44 === undefined) return [];
    const pubkey = await identity.getPublicKey();
    const wraps = await this.#queryUnion(
      this.#relays,
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
  if (command.type === "delete") {
    return [
      {
        kind: 5,
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
