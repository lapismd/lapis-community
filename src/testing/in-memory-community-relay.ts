import { matchFilter } from "nostr-tools/filter";
import { finalizeEvent, verifyEvent } from "nostr-tools/pure";

import type {
  CommunityRelay,
  CommunityRelayFactory,
  CommunityRelaySubscription,
  CommunityRelaySubscriptionHandlers,
  RelayAuthSigner,
  RelayFilter,
  RelayPublishResult,
} from "../nostr/index.js";
import type { RelayCountResult } from "../nostr/transport.js";
import type {
  NostrEvent,
  NostrEventTemplate,
  NostrTag,
} from "../protocol/index.js";

export interface InMemoryRelayFaults {
  latencyMs?: number;
  countLatencyMs?: number;
  countApproximate?: boolean;
  rejectCount?: string;
  disconnected?: boolean;
  dropSubscriptions?: boolean;
  duplicateDeliveries?: number;
  rejectPublish?:
    | string
    | ((event: NostrEvent) => string | undefined)
    | undefined;
}

export interface InMemoryRelayAuthentication {
  read?: boolean;
  write?: boolean;
}

export interface InMemoryRelayPolicyResult {
  generatedEvents?: readonly NostrEvent[];
  removeEvents?: ((event: NostrEvent) => boolean) | undefined;
}

export interface InMemoryRelayPolicy {
  process(event: NostrEvent): InMemoryRelayPolicyResult | undefined;
  reset?(): void;
}

export interface InMemoryCommunityRelayOptions {
  url?: string;
  events?: readonly NostrEvent[];
  authentication?: InMemoryRelayAuthentication;
  faults?: InMemoryRelayFaults;
  policy?: InMemoryRelayPolicy;
  now?: () => number;
}

interface ActiveSubscription {
  filter: RelayFilter;
  handlers: CommunityRelaySubscriptionHandlers;
  closed: boolean;
}

function compareNewest(left: NostrEvent, right: NostrEvent): number {
  return right.created_at - left.created_at || right.id.localeCompare(left.id);
}

function copyEvent(event: NostrEvent): NostrEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag) => [...tag]),
    content: event.content,
    sig: event.sig,
  };
}

function replacementKey(event: NostrEvent): string | undefined {
  if (
    event.kind === 0 ||
    event.kind === 3 ||
    (event.kind >= 10_000 && event.kind < 20_000)
  ) {
    return `${event.kind}:${event.pubkey}`;
  }
  if (event.kind >= 30_000 && event.kind < 40_000) {
    const identifier = event.tags.find((tag) => tag[0] === "d")?.[1] ?? "";
    return `${event.kind}:${event.pubkey}:${identifier}`;
  }
  return undefined;
}

export class InMemoryCommunityRelay implements CommunityRelay {
  readonly url: string;

  readonly #events = new Map<string, NostrEvent>();
  readonly #subscriptions = new Set<ActiveSubscription>();
  readonly #authentication: InMemoryRelayAuthentication;
  readonly #policy: InMemoryRelayPolicy | undefined;
  readonly #now: () => number;
  #faults: InMemoryRelayFaults;
  #authenticatedPubkey = "";
  #closed = false;

  constructor(options: InMemoryCommunityRelayOptions = {}) {
    this.url = options.url ?? "memory://lapis-community";
    this.#authentication = options.authentication ?? {};
    this.#faults = options.faults ?? {};
    this.#policy = options.policy;
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
    for (const event of options.events ?? []) this.inject(event);
  }

  get events(): readonly NostrEvent[] {
    return [...this.#events.values()].toSorted(compareNewest).map(copyEvent);
  }

  get authenticatedPubkey(): string | undefined {
    return this.#authenticatedPubkey || undefined;
  }

  setFaults(faults: InMemoryRelayFaults): void {
    this.#faults = faults;
  }

  reset(events: readonly NostrEvent[] = []): void {
    this.#events.clear();
    this.#authenticatedPubkey = "";
    this.#closed = false;
    this.#policy?.reset?.();
    for (const event of events) this.inject(event);
  }

  /** Reopens the shared in-memory endpoint for a new factory connection. */
  reopen(): void {
    this.#closed = false;
  }

  inject(
    event: NostrEvent,
    options: { verify?: boolean; notify?: boolean } = {},
  ): void {
    if (options.verify !== false && !verifyEvent(copyEvent(event))) {
      throw new Error("In-memory relay rejected an invalid Nostr event");
    }
    if (
      ((event.kind >= 20000 && event.kind < 30000) ||
        this.#retain(copyEvent(event))) &&
      options.notify !== false
    ) {
      this.#notify(event);
    }
  }

  async authenticate(
    signEvent: RelayAuthSigner,
    signal?: AbortSignal,
  ): Promise<RelayPublishResult> {
    await this.#beforeOperation(signal, false);
    const challenge = `memory-${this.#now().toString(36)}`;
    const event = await signEvent({
      kind: 22_242,
      created_at: this.#now(),
      content: "",
      tags: [
        ["relay", this.url],
        ["challenge", challenge],
      ],
    });
    signal?.throwIfAborted();
    if (
      !verifyEvent(copyEvent(event)) ||
      event.kind !== 22_242 ||
      !event.tags.some((tag) => tag[0] === "challenge" && tag[1] === challenge)
    ) {
      throw new Error("In-memory relay authentication signature is invalid");
    }
    this.#authenticatedPubkey = event.pubkey;
    return { accepted: true, message: "authenticated" };
  }

  async query(
    filter: RelayFilter,
    signal?: AbortSignal,
  ): Promise<NostrEvent[]> {
    await this.#beforeOperation(signal, this.#authentication.read === true);
    const events = [...this.#events.values()]
      .filter((event) => matchFilter(filter, event))
      .toSorted(compareNewest);
    return events
      .slice(0, filter.limit ?? events.length)
      .map((event) => copyEvent(event));
  }

  async count(filter: RelayFilter, signal?: AbortSignal): Promise<number> {
    await this.#beforeOperation(signal, this.#authentication.read === true);
    const countFilter = { ...filter };
    delete countFilter.limit;
    return [...this.#events.values()].filter((event) =>
      matchFilter(countFilter, event),
    ).length;
  }

  async countMany(
    filters: readonly RelayFilter[],
    signal?: AbortSignal,
  ): Promise<RelayCountResult> {
    await this.#beforeOperation(signal, this.#authentication.read === true);
    if (this.#faults.rejectCount !== undefined) {
      throw new Error(this.#faults.rejectCount);
    }
    const countLatency = filters.some(
      (filter) => filter.since === undefined && filter.until === undefined,
    )
      ? Math.max(0, this.#faults.countLatencyMs ?? 0)
      : 0;
    if (countLatency > 0) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, countLatency);
        signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            reject(signal.reason);
          },
          { once: true },
        );
      });
    }
    const countFilters = filters.map((filter) => {
      const countFilter = { ...filter };
      delete countFilter.limit;
      return countFilter;
    });
    return {
      count: [...this.#events.values()].filter((event) =>
        countFilters.some((filter) => matchFilter(filter, event)),
      ).length,
      approximate: this.#faults.countApproximate === true,
    };
  }

  async subscribe(
    filter: RelayFilter,
    handlers: CommunityRelaySubscriptionHandlers,
    signal?: AbortSignal,
  ): Promise<CommunityRelaySubscription> {
    await this.#beforeOperation(signal, this.#authentication.read === true);
    const active: ActiveSubscription = {
      filter: { ...filter },
      handlers,
      closed: false,
    };
    this.#subscriptions.add(active);
    const close = (reason = "closed"): void => {
      if (active.closed) return;
      active.closed = true;
      this.#subscriptions.delete(active);
      active.handlers.onclose?.(reason);
    };
    signal?.addEventListener("abort", () => close("aborted"), { once: true });
    queueMicrotask(() => {
      if (!active.closed) handlers.oneose?.();
    });
    return { close };
  }

  async publish(
    event: NostrEvent,
    signal?: AbortSignal,
  ): Promise<RelayPublishResult> {
    await this.#beforeOperation(signal, this.#authentication.write === true);
    if (!verifyEvent(copyEvent(event))) {
      throw new Error("In-memory relay rejected an invalid Nostr event");
    }
    if (
      this.#authentication.write === true &&
      this.#authenticatedPubkey !== event.pubkey
    ) {
      throw new Error(
        "In-memory relay rejected publishing on behalf of another author",
      );
    }
    const rejection =
      typeof this.#faults.rejectPublish === "function"
        ? this.#faults.rejectPublish(event)
        : this.#faults.rejectPublish;
    if (rejection !== undefined) throw new Error(rejection);

    const policyResult = this.#policy?.process(event);
    if (policyResult?.removeEvents !== undefined) {
      for (const [id, stored] of this.#events) {
        if (policyResult.removeEvents(stored)) this.#events.delete(id);
      }
    }
    const retained =
      (event.kind >= 20000 && event.kind < 30000) ||
      this.#retain(copyEvent(event));
    if (retained) this.#notify(event);
    for (const generated of policyResult?.generatedEvents ?? []) {
      if (!verifyEvent(copyEvent(generated))) {
        throw new Error("In-memory relay policy generated an invalid event");
      }
      if (
        (generated.kind >= 20000 && generated.kind < 30000) ||
        this.#retain(copyEvent(generated))
      )
        this.#notify(generated);
    }
    return {
      accepted: true,
      message: retained ? "stored" : "superseded",
    };
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const subscription of [...this.#subscriptions]) {
      subscription.closed = true;
      subscription.handlers.onclose?.("relay closed");
    }
    this.#subscriptions.clear();
  }

  async #beforeOperation(
    signal: AbortSignal | undefined,
    authenticationRequired: boolean,
  ): Promise<void> {
    signal?.throwIfAborted();
    if (this.#closed) throw new Error(`${this.url}: relay is closed`);
    if (this.#faults.disconnected === true) {
      throw new Error(`${this.url}: relay is disconnected`);
    }
    if (authenticationRequired && this.#authenticatedPubkey === "") {
      throw new Error(`${this.url}: NIP-42 authentication required`);
    }
    const latency = Math.max(0, this.#faults.latencyMs ?? 0);
    if (latency === 0) return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, latency);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }

  #retain(event: NostrEvent): boolean {
    if (this.#events.has(event.id)) return false;
    if (event.kind === 5) {
      const targets = new Set(
        event.tags
          .filter((tag) => tag[0] === "e" && tag[1] !== undefined)
          .map((tag) => tag[1]!),
      );
      for (const [id, stored] of this.#events) {
        if (targets.has(id) && stored.pubkey === event.pubkey) {
          this.#events.delete(id);
        }
      }
    }
    const key = replacementKey(event);
    if (key !== undefined) {
      const current = [...this.#events.values()].find(
        (candidate) => replacementKey(candidate) === key,
      );
      if (current !== undefined) {
        if (compareNewest(event, current) >= 0) return false;
        this.#events.delete(current.id);
      }
    }
    this.#events.set(event.id, event);
    return true;
  }

  #notify(event: NostrEvent): void {
    if (this.#faults.dropSubscriptions === true) return;
    const deliveries = Math.max(1, this.#faults.duplicateDeliveries ?? 1);
    for (const subscription of this.#subscriptions) {
      if (subscription.closed || !matchFilter(subscription.filter, event)) {
        continue;
      }
      for (let index = 0; index < deliveries; index += 1) {
        subscription.handlers.onevent(copyEvent(event));
      }
    }
  }
}

export interface InMemoryRelayFactoryOptions
  extends Omit<InMemoryCommunityRelayOptions, "url"> {
  relayOptions?: ((url: string) => InMemoryCommunityRelayOptions) | undefined;
}

export interface InMemoryCommunityRelayFactory extends CommunityRelayFactory {
  relay(url: string): InMemoryCommunityRelay;
  reset(): void;
}

export function createInMemoryRelayFactory(
  options: InMemoryRelayFactoryOptions = {},
): InMemoryCommunityRelayFactory {
  const relays = new Map<string, InMemoryCommunityRelay>();
  return {
    create(url) {
      const current = relays.get(url);
      if (current !== undefined) {
        current.reopen();
        return current;
      }
      const specific = options.relayOptions?.(url) ?? {};
      const relay = new InMemoryCommunityRelay({
        ...options,
        ...specific,
        url,
      });
      relays.set(url, relay);
      return relay;
    },
    relay(url) {
      return this.create(url) as InMemoryCommunityRelay;
    },
    reset() {
      for (const relay of relays.values()) relay.close();
      relays.clear();
    },
  };
}

interface Nip29MemoryGroup {
  id: string;
  metadata: Map<string, NostrTag>;
  admins: Map<string, readonly string[]>;
  members: Map<string, readonly string[]>;
  invites: Set<string>;
}

export interface Nip29MemoryPolicyOptions {
  relaySecretKey: Uint8Array;
  now?: () => number;
}

export class Nip29MemoryPolicy implements InMemoryRelayPolicy {
  readonly #relaySecretKey: Uint8Array;
  readonly #groups = new Map<string, Nip29MemoryGroup>();
  readonly #now: () => number;

  constructor(options: Nip29MemoryPolicyOptions) {
    if (options.relaySecretKey.byteLength !== 32) {
      throw new Error("Relay secret key must contain exactly 32 bytes");
    }
    this.#relaySecretKey = options.relaySecretKey.slice();
    this.#now = options.now ?? (() => Math.floor(Date.now() / 1_000));
  }

  reset(): void {
    this.#groups.clear();
  }

  process(event: NostrEvent): InMemoryRelayPolicyResult | undefined {
    if ([9, 11, 1_111].includes(event.kind)) {
      const contentGroupId = event.tags.find((tag) => tag[0] === "h")?.[1];
      const contentGroup =
        contentGroupId === undefined
          ? undefined
          : this.#groups.get(contentGroupId);
      if (
        contentGroup?.metadata.has("write-restricted") === true &&
        !contentGroup.admins.has(event.pubkey) &&
        !contentGroup.members.get(event.pubkey)?.includes("writer")
      ) {
        throw new Error("NIP-29 writer permission required");
      }
      return undefined;
    }
    if (event.kind < 9_000 || event.kind > 9_022) return undefined;
    const groupId = event.tags.find((tag) => tag[0] === "h")?.[1];
    if (groupId === undefined || groupId === "") {
      throw new Error("NIP-29 management event is missing its group id");
    }

    if (event.kind === 9_007) {
      if (this.#groups.has(groupId)) {
        throw new Error(`NIP-29 group ${groupId} already exists`);
      }
      const metadata = new Map<string, NostrTag>();
      for (const tag of event.tags) {
        if (tag[0] !== "h" && tag[0] !== undefined) {
          metadata.set(tag[0], [...tag]);
        }
      }
      const content = parseObject(event.content);
      for (const key of ["name", "about", "picture"] as const) {
        const value = content?.[key];
        if (typeof value === "string" && !metadata.has(key)) {
          metadata.set(key, [key, value]);
        }
      }
      const group: Nip29MemoryGroup = {
        id: groupId,
        metadata,
        admins: new Map([[event.pubkey, ["admin"]]]),
        members: new Map([[event.pubkey, ["admin"]]]),
        invites: new Set(),
      };
      this.#groups.set(groupId, group);
      return { generatedEvents: this.#stateEvents(group, event.created_at) };
    }

    const group = this.#groups.get(groupId);
    if (group === undefined) throw new Error(`Unknown NIP-29 group ${groupId}`);
    const isAdmin = group.admins.has(event.pubkey);
    if (
      [9_000, 9_001, 9_002, 9_005, 9_008, 9_009].includes(event.kind) &&
      !isAdmin
    ) {
      throw new Error("NIP-29 administrator permission required");
    }

    if (
      event.kind === 9_021 &&
      group.metadata.has("private") &&
      !group.members.has(event.pubkey)
    ) {
      const code = event.tags.find((tag) => tag[0] === "code")?.[1];
      if (code === undefined || !group.invites.has(code)) {
        throw new Error("NIP-29 invite code required");
      }
    }

    if (event.kind === 9_000) {
      for (const tag of event.tags.filter((tag) => tag[0] === "p")) {
        if (tag[1] !== undefined) group.members.set(tag[1], tag.slice(2));
      }
    } else if (event.kind === 9_001) {
      for (const tag of event.tags.filter((tag) => tag[0] === "p")) {
        if (tag[1] !== undefined) {
          group.members.delete(tag[1]);
          group.admins.delete(tag[1]);
        }
      }
    } else if (event.kind === 9_002) {
      const content = parseObject(event.content);
      if (content?.private === false) group.metadata.delete("private");
      if (content?.["write-restricted"] === false) {
        group.metadata.delete("write-restricted");
      }
      for (const tag of event.tags) {
        if (tag[0] !== "h" && tag[0] !== undefined) {
          group.metadata.set(tag[0], [...tag]);
        }
      }
    } else if (event.kind === 9_009) {
      const code = event.tags.find((tag) => tag[0] === "code")?.[1];
      if (code === undefined || code === "") {
        throw new Error("NIP-29 invite code is required");
      }
      group.invites.add(code);
    } else if (event.kind === 9_021) {
      group.members.set(event.pubkey, []);
    } else if (event.kind === 9_022) {
      group.members.delete(event.pubkey);
      group.admins.delete(event.pubkey);
    } else if (event.kind === 9_008) {
      this.#groups.delete(groupId);
      return {
        removeEvents: (stored) =>
          stored.kind >= 39_000 &&
          stored.kind <= 39_003 &&
          stored.tags.some((tag) => tag[0] === "d" && tag[1] === groupId),
      };
    } else if (event.kind === 9_005) {
      const targets = new Set(
        event.tags
          .filter((tag) => tag[0] === "e" && tag[1] !== undefined)
          .map((tag) => tag[1]!),
      );
      return {
        removeEvents: (stored) => targets.has(stored.id),
        generatedEvents: this.#stateEvents(group, event.created_at),
      };
    }

    return { generatedEvents: this.#stateEvents(group, event.created_at) };
  }

  #stateEvents(
    group: Nip29MemoryGroup,
    requestedTimestamp: number,
  ): NostrEvent[] {
    const createdAt = Math.max(requestedTimestamp, this.#now());
    return [
      this.#sign({
        kind: 39_000,
        created_at: createdAt,
        content: "",
        tags: [
          ["d", group.id],
          ...[...group.metadata.values()].map((tag) => [...tag]),
        ],
      }),
      this.#sign({
        kind: 39_001,
        created_at: createdAt,
        content: "",
        tags: [
          ["d", group.id],
          ...[...group.admins.entries()]
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([pubkey, roles]) => ["p", pubkey, ...roles]),
        ],
      }),
      this.#sign({
        kind: 39_002,
        created_at: createdAt,
        content: "",
        tags: [
          ["d", group.id],
          ...[...group.members.entries()]
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([pubkey, roles]) => ["p", pubkey, ...roles]),
        ],
      }),
      this.#sign({
        kind: 39_003,
        created_at: createdAt,
        content: "",
        tags: [
          ["d", group.id],
          [
            "role",
            "writer",
            "Can publish when this group is limited to writers.",
          ],
        ],
      }),
    ];
  }

  #sign(template: NostrEventTemplate): NostrEvent {
    return finalizeEvent(template, this.#relaySecretKey);
  }
}

function parseObject(content: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(content) as unknown;
    return value !== null && !Array.isArray(value) && typeof value === "object"
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
