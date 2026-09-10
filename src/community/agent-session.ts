import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { matchFilter } from "nostr-tools/filter";
import type { CommunitySigner } from "../auth/index.js";
import { encodeNostrHttpAuthorization } from "../nostr/http-authorization.js";
import type { CommunityRelay, RelayFilter } from "../nostr/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import type { CommunityScope } from "./contracts.js";
import type {
  CommunityAgentCapabilities,
  CommunityAgentDirectory,
  CommunityAgentSession,
} from "./agent-contracts.js";
import {
  AGENT_PUBKEY,
  agentTag,
  materializeAgentDirectory,
  newestAgentEvent,
  signedAgentEvent,
} from "./agent-protocol.js";

interface AgentSessionOptions {
  scope: CommunityScope;
  identity: CommunitySigner;
  relay: CommunityRelay;
  authenticate(signal?: AbortSignal): Promise<void>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

type QueryFilter = RelayFilter & { before_id?: string };
interface RelayInfo {
  self: string;
  capabilities: CommunityAgentCapabilities;
}
const PAGE_SIZE = 500;
const MAX_DIRECTORY_RECORDS = 10_000;
const MAX_CANDIDATES = 2_000;

export function createCommunityAgentSession(
  options: AgentSessionOptions,
): CommunityAgentSession {
  return new AgentSession(options);
}

class AgentSession implements CommunityAgentSession {
  readonly #options: AgentSessionOptions;
  readonly #fetch: typeof globalThis.fetch;
  #info: RelayInfo | undefined;
  #followQueue: Promise<unknown> = Promise.resolve();
  #lastFollowAt = 0;

  constructor(options: AgentSessionOptions) {
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  #now(): number {
    return Math.floor(this.#options.now?.() ?? Date.now() / 1_000);
  }

  #url(path?: string): URL {
    const url = new URL(this.#options.scope.relayUrl);
    if (url.protocol === "wss:") url.protocol = "https:";
    else if (url.protocol === "ws:") url.protocol = "http:";
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new Error("Unsupported agent relay URL");
    url.search = "";
    url.hash = "";
    return path ? new URL(path, url) : url;
  }

  async #relayInfo(signal?: AbortSignal): Promise<RelayInfo> {
    signal?.throwIfAborted();
    if (this.#info) return this.#info;
    const response = await this.#fetch(this.#url(), {
      headers: { Accept: "application/nostr+json" },
      signal: requestSignal(signal),
    });
    if (!response.ok)
      throw new Error(`Agent capability discovery failed (${response.status})`);
    const info = (await response.json()) as {
      self?: unknown;
      supported_nips?: unknown;
    };
    signal?.throwIfAborted();
    const nips = Array.isArray(info.supported_nips) ? info.supported_nips : [];
    const validSelf =
      typeof info.self === "string" && AGENT_PUBKEY.test(info.self);
    const directory = validSelf && nips.includes("OA") && nips.includes(29);
    this.#info = {
      self: validSelf ? (info.self as string) : "",
      capabilities: {
        directory,
        presence: directory,
        activity: directory && nips.includes("AO") && nips.includes(44),
      },
    };
    return this.#info;
  }

  async #sign(
    template: NostrEventTemplate,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    signal?.throwIfAborted();
    const owner = await this.#options.identity.getPublicKey();
    const result = await this.#options.identity.signEvent(template);
    signal?.throwIfAborted();
    const signed = signedAgentEvent(result);
    if (
      !signed ||
      signed.pubkey !== owner ||
      signed.kind !== template.kind ||
      signed.created_at !== template.created_at ||
      signed.content !== template.content ||
      JSON.stringify(signed.tags) !== JSON.stringify(template.tags)
    )
      throw new Error("Signer returned an invalid agent operation");
    return signed;
  }

  async #query(
    filters: readonly QueryFilter[],
    signal?: AbortSignal,
    presence = false,
  ): Promise<NostrEvent[]> {
    const body = JSON.stringify(filters);
    const url = this.#url("/query");
    const auth = await this.#sign(
      {
        kind: 27235,
        created_at: this.#now(),
        content: "",
        tags: [
          ["u", url.toString()],
          ["method", "POST"],
          ["payload", bytesToHex(sha256(new TextEncoder().encode(body)))],
          ["nonce", crypto.randomUUID()],
        ],
      },
      signal,
    );
    const response = await this.#fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: encodeNostrHttpAuthorization(auth),
      },
      body,
      signal: requestSignal(signal),
    });
    if (!response.ok)
      throw new Error(`Agent query failed (${response.status})`);
    const result: unknown = await response.json();
    signal?.throwIfAborted();
    if (!Array.isArray(result) || result.length > 10_000)
      throw new Error("Agent relay returned an invalid query result");
    return [
      ...new Map(
        result.flatMap((input) => {
          const event = signedAgentEvent(input);
          return event &&
            (presence ||
              filters.some(
                (filter) =>
                  matchFilter(filter, event) &&
                  (!filter.before_id ||
                    event.created_at < filter.until! ||
                    (event.created_at === filter.until &&
                      event.id < filter.before_id)),
              ))
            ? [[event.id, event] as const]
            : [];
        }),
      ).values(),
    ];
  }

  async #all(
    filter: QueryFilter,
    signal?: AbortSignal,
  ): Promise<{ events: NostrEvent[]; partial: boolean }> {
    const events: NostrEvent[] = [];
    let cursor: QueryFilter = { ...filter, limit: PAGE_SIZE };
    let previous = "";
    while (events.length < MAX_DIRECTORY_RECORDS) {
      const page = (await this.#query([cursor], signal)).sort(
        (a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id),
      );
      events.push(...page);
      if (page.length < PAGE_SIZE) return { events, partial: false };
      const last = page.at(-1)!;
      if (last.id === previous) return { events, partial: true };
      previous = last.id;
      cursor = { ...cursor, until: last.created_at, before_id: last.id };
    }
    return { events, partial: true };
  }

  async #batches(
    filters: readonly QueryFilter[],
    signal?: AbortSignal,
  ): Promise<NostrEvent[]> {
    const events: NostrEvent[] = [];
    // At most four requests, each with ten exact filters, in flight.
    for (let start = 0; start < filters.length; start += 40) {
      const batches: QueryFilter[][] = [];
      for (
        let index = start;
        index < Math.min(start + 40, filters.length);
        index += 10
      )
        batches.push(filters.slice(index, index + 10));
      const results = await Promise.all(
        batches.map((batch) => this.#query(batch, signal)),
      );
      events.push(...results.flat());
    }
    return events;
  }

  async loadDirectory(signal?: AbortSignal): Promise<CommunityAgentDirectory> {
    const info = await this.#relayInfo(signal);
    if (!info.capabilities.directory)
      return {
        agents: [],
        events: [],
        relayPubkey: info.self,
        capabilities: info.capabilities,
        partial: false,
        reason: "This relay does not advertise agent ownership support",
      };
    const owner = await this.#options.identity.getPublicKey();
    const [owned, membership, contacts] = await Promise.all([
      this.#all({ kinds: [30177], authors: [owner] }, signal),
      this.#all(
        { kinds: [39002], authors: [info.self], "#p": [owner] },
        signal,
      ),
      this.#query([{ kinds: [3], authors: [owner], limit: 1 }], signal),
    ]);
    const candidateKeys = new Set<string>();
    for (const event of owned.events) {
      const key = agentTag(event, "d");
      if (key && AGENT_PUBKEY.test(key) && key !== owner)
        candidateKeys.add(key);
    }
    for (const event of membership.events)
      for (const [tag, key] of event.tags)
        if (tag === "p" && key && key !== owner && AGENT_PUBKEY.test(key))
          candidateKeys.add(key);
    const candidates = [...candidateKeys].sort().slice(0, MAX_CANDIDATES);
    const profiles = await this.#batches(
      candidates.flatMap((key) =>
        [0, 10100].map((kind) => ({ authors: [key], kinds: [kind], limit: 1 })),
      ),
      signal,
    );
    const events = [
      ...owned.events,
      ...membership.events,
      ...contacts,
      ...profiles,
    ];
    const tombstones: NostrEvent[] = [];
    let partial =
      owned.partial ||
      membership.partial ||
      candidateKeys.size > MAX_CANDIDATES;
    // Retain author-valid tombstones even if the relay returns a deleted head.
    for (let start = 0; start < events.length; start += 200) {
      const batch = events.slice(start, start + 200);
      const authors = [...new Set(batch.map((event) => event.pubkey))];
      const [byId, byAddress] = await Promise.all([
        this.#all(
          { kinds: [5], authors, "#e": batch.map((event) => event.id) },
          signal,
        ),
        this.#all(
          {
            kinds: [5],
            authors,
            "#a": batch.map(
              (event) =>
                `${event.kind}:${event.pubkey}:${agentTag(event, "d") ?? ""}`,
            ),
          },
          signal,
        ),
      ]);
      // Deletions are collected separately so the query loop has a stable bound.
      tombstones.push(...byId.events, ...byAddress.events);
      partial ||= byId.partial || byAddress.partial;
    }
    return {
      agents: materializeAgentDirectory(
        [...events, ...tombstones],
        owner,
        info.self,
      ),
      events: [...events, ...tombstones],
      relayPubkey: info.self,
      capabilities: info.capabilities,
      partial,
      ...(partial
        ? { reason: "The relay returned a partial agent directory" }
        : {}),
    };
  }

  async loadPresence(
    pubkeys: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]> {
    const info = await this.#relayInfo(signal);
    if (!info.capabilities.presence || pubkeys.length === 0) return [];
    const events: NostrEvent[] = [];
    for (let start = 0; start < pubkeys.length; start += 100) {
      const subjects = pubkeys.slice(start, start + 100);
      const page = await this.#query(
        [{ kinds: [40902], authors: [...subjects] }],
        signal,
        true,
      );
      events.push(
        ...page.filter(
          (event) =>
            event.kind === 20001 &&
            event.pubkey === info.self &&
            subjects.includes(agentTag(event, "p") ?? ""),
        ),
      );
    }
    return events;
  }

  async subscribe(
    pubkeys: readonly string[],
    handlers: {
      onevent(event: NostrEvent): void;
      onclose(reason: string): void;
    },
    signal?: AbortSignal,
  ): Promise<{ close(): void }> {
    const info = await this.#relayInfo(signal);
    const owner = await this.#options.identity.getPublicKey();
    if (!info.capabilities.directory) return { close() {} };
    await this.#options.authenticate(signal);
    const filters: RelayFilter[] = [
      { kinds: [30177, 3, 5], authors: [owner] },
      { kinds: [39002], authors: [info.self], "#p": [owner] },
      ...(info.capabilities.activity
        ? [{ kinds: [24200], "#p": [owner], since: this.#now() }]
        : []),
    ];
    for (let start = 0; start < pubkeys.length; start += 100)
      filters.push({
        kinds: [0, 10100, 5, 20001, 20002],
        authors: pubkeys.slice(start, start + 100),
      });
    let closed = false;
    const subscriptions: { close(): void }[] = [];
    const close = () => {
      closed = true;
      subscriptions.forEach((subscription) => subscription.close());
    };
    try {
      for (const filter of filters)
        subscriptions.push(
          await this.#options.relay.subscribe(
            filter,
            {
              onevent: (input) => {
                const event = signedAgentEvent(input);
                if (!closed && event && matchFilter(filter, event))
                  handlers.onevent(event);
              },
              onclose: (reason) => {
                if (!closed && !signal?.aborted) handlers.onclose(reason);
              },
            },
            signal,
          ),
        );
      signal?.throwIfAborted();
      return { close };
    } catch (error) {
      close();
      throw error;
    }
  }

  setFollow(
    pubkey: string,
    following: boolean,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    const result = this.#followQueue
      .catch(() => undefined)
      .then(async () => {
        if (!AGENT_PUBKEY.test(pubkey))
          throw new Error("Invalid agent public key");
        const owner = await this.#options.identity.getPublicKey();
        if (pubkey === owner)
          throw new Error("Cannot follow your own identity");
        const current = newestAgentEvent(
          await this.#query(
            [{ kinds: [3], authors: [owner], limit: 1 }],
            signal,
          ),
        );
        const tags = current?.tags.map((tag) => [...tag]) ?? [];
        const followed = tags.some(
          ([tag, value]) => tag === "p" && value === pubkey,
        );
        if (current && followed === following) return current;
        const nextTags = following
          ? [...tags, ["p", pubkey]]
          : tags.filter(([tag, value]) => !(tag === "p" && value === pubkey));
        const created_at = Math.max(
          this.#now(),
          (current?.created_at ?? 0) + 1,
          this.#lastFollowAt + 1,
        );
        if (created_at > this.#now() + 60)
          throw new Error(
            "Contact list timestamp is ahead of this device; retry after checking its clock",
          );
        const event = await this.#sign(
          {
            kind: 3,
            created_at,
            tags: nextTags,
            content: current?.content ?? "",
          },
          signal,
        );
        await this.#options.authenticate(signal);
        const result = await this.#options.relay.publish(event, signal);
        if (!result.accepted)
          throw new Error("The relay rejected the contact-list update");
        this.#lastFollowAt = created_at;
        return event;
      });
    this.#followQueue = result;
    return result;
  }
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  return AbortSignal.any([
    AbortSignal.timeout(15_000),
    ...(signal ? [signal] : []),
  ]);
}
