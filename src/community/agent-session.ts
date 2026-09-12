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
  CommunityAgentControl,
  CommunityAgentDirectory,
  CommunityAgentPersonaSaveInput,
  CommunityAgentSaveInput,
  CommunityAgentSaveResult,
  CommunityAgentSession,
} from "./agent-contracts.js";
import {
  AGENT_PERSONA_SLUG,
  AGENT_PUBKEY,
  agentJson,
  agentTag,
  materializeAgentDirectory,
  materializeAgentPersonas,
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
  #managementQueue: Promise<unknown> = Promise.resolve();
  #lastFollowAt = 0;
  #lastManagementAt = 0;

  constructor(options: AgentSessionOptions) {
    this.#options = options;
    this.#fetch = (options.fetch ?? globalThis.fetch).bind(globalThis);
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
    // Buzz advertises numeric NIPs, without OA/AO or client-side NIP-44.
    // Probe the bridge; only verified profiles establish owned identities.
    const directory = validSelf && nips.includes(29);
    this.#info = {
      self: validSelf ? (info.self as string) : "",
      capabilities: {
        directory,
        presence: directory,
        activity: directory && (nips.includes("AO") || nips.includes(16)),
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
        personas: [],
        events: [],
        relayPubkey: info.self,
        capabilities: info.capabilities,
        partial: false,
        reason:
          "This relay does not advertise the required agent bridge capabilities",
      };
    const owner = await this.#options.identity.getPublicKey();
    const [owned, personas, membership, contacts] = await Promise.all([
      this.#all({ kinds: [30177], authors: [owner] }, signal),
      this.#all({ kinds: [30175], authors: [owner] }, signal),
      this.#all({ kinds: [39002], authors: [info.self] }, signal),
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
      ...personas.events,
      ...membership.events,
      ...contacts,
      ...profiles,
    ];
    const tombstones: NostrEvent[] = [];
    let partial =
      owned.partial ||
      personas.partial ||
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
    const projectedEvents = [...events, ...tombstones];
    return {
      agents: materializeAgentDirectory(projectedEvents, owner, info.self),
      personas: materializeAgentPersonas(projectedEvents, owner),
      events: projectedEvents,
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
      { kinds: [30175, 30177, 3, 5], authors: [owner] },
      { kinds: [39002], authors: [info.self] },
      ...(info.capabilities.activity
        ? [{ kinds: [24200], "#p": [owner], since: this.#now() - 300 }]
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

  registerAgent(pubkey: string, signal?: AbortSignal): Promise<NostrEvent> {
    const result = this.#managementQueue
      .catch(() => undefined)
      .then(async () => {
        if (!AGENT_PUBKEY.test(pubkey))
          throw new Error("Invalid agent public key");
        const info = await this.#relayInfo(signal);
        if (!info.capabilities.directory)
          throw new Error("Agent registration is unavailable on this relay");
        const owner = await this.#options.identity.getPublicKey();
        if (pubkey === owner)
          throw new Error("Cannot register your own identity as an agent");
        const current = newestAgentEvent(
          await this.#query(
            [{ kinds: [30177], authors: [owner], "#d": [pubkey], limit: 1 }],
            signal,
          ),
        );
        // Registration is idempotent and must never erase an existing persona
        // link or legacy instance configuration.
        if (current) return current;
        const created_at = Math.max(this.#now(), this.#lastManagementAt + 1);
        if (created_at > this.#now() + 60)
          throw new Error(
            "Agent registration timestamp is ahead of this device; retry after checking its clock",
          );
        const event = await this.#sign(
          {
            kind: 30177,
            created_at,
            tags: [["d", pubkey]],
            content: "{}",
          },
          signal,
        );
        await this.#options.authenticate(signal);
        const publish = await this.#options.relay.publish(event, signal);
        if (!publish.accepted)
          throw new Error("The relay rejected the agent registration");
        this.#lastManagementAt = created_at;
        return event;
      });
    this.#managementQueue = result;
    return result;
  }

  saveAgent(
    input: CommunityAgentSaveInput,
    signal?: AbortSignal,
  ): Promise<CommunityAgentSaveResult> {
    const result = this.#managementQueue
      .catch(() => undefined)
      .then(async () => {
        this.#validateSaveInput(input);
        const info = await this.#relayInfo(signal);
        if (!info.capabilities.directory)
          throw new Error("Persona management is unavailable on this relay");
        const owner = await this.#options.identity.getPublicKey();
        if (input.pubkey === owner)
          throw new Error("Cannot register your own identity as an agent");
        const [personaHead, instanceHead] = await Promise.all([
          this.#query(
            [
              {
                kinds: [30175],
                authors: [owner],
                "#d": [input.personaSlug],
                limit: 1,
              },
            ],
            signal,
          ).then(newestAgentEvent),
          this.#query(
            [
              {
                kinds: [30177],
                authors: [owner],
                "#d": [input.pubkey],
                limit: 1,
              },
            ],
            signal,
          ).then(newestAgentEvent),
        ]);

        const persona = await this.#writePersona(input, personaHead, signal);

        const instanceContent = agentJson(instanceHead?.content ?? "{}");
        instanceContent.persona_id = input.personaSlug;
        instanceContent.name_mode = input.nameMode;
        instanceContent.name =
          input.nameMode === "instance"
            ? input.instanceName?.trim() || input.displayName.trim()
            : input.instanceName?.trim() || input.displayName.trim();
        if (typeof instanceContent.respond_to !== "string")
          instanceContent.respond_to = "owner-only";
        if (
          typeof instanceContent.parallelism !== "number" ||
          !Number.isInteger(instanceContent.parallelism) ||
          instanceContent.parallelism < 1
        )
          instanceContent.parallelism = 10;
        const instanceJSON = JSON.stringify(instanceContent);
        let instance: NostrEvent | undefined;
        if (!instanceHead || instanceHead.content !== instanceJSON) {
          const created_at = this.#nextManagementTimestamp(instanceHead);
          instance = await this.#sign(
            {
              kind: 30177,
              created_at,
              tags: instanceHead?.tags.map((tag) => [...tag]) ?? [
                ["d", input.pubkey],
              ],
              content: instanceJSON,
            },
            signal,
          );
          await this.#publish(instance, "agent link", signal);
          this.#lastManagementAt = created_at;
        }
        return { persona, ...(instance ? { instance } : {}) };
      });
    this.#managementQueue = result;
    return result;
  }

  savePersona(
    input: CommunityAgentPersonaSaveInput,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    const result = this.#managementQueue
      .catch(() => undefined)
      .then(async () => {
        this.#validatePersonaInput(input);
        const info = await this.#relayInfo(signal);
        if (!info.capabilities.directory)
          throw new Error("Persona management is unavailable on this relay");
        const owner = await this.#options.identity.getPublicKey();
        const head = newestAgentEvent(
          await this.#query(
            [
              {
                kinds: [30175],
                authors: [owner],
                "#d": [input.personaSlug],
                limit: 1,
              },
            ],
            signal,
          ),
        );
        return this.#writePersona(input, head, signal);
      });
    this.#managementQueue = result;
    return result;
  }

  unlinkAgent(
    pubkey: string,
    fallbackName: string,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    const result = this.#managementQueue
      .catch(() => undefined)
      .then(async () => {
        if (!AGENT_PUBKEY.test(pubkey))
          throw new Error("Invalid agent public key");
        const owner = await this.#options.identity.getPublicKey();
        const current = newestAgentEvent(
          await this.#query(
            [{ kinds: [30177], authors: [owner], "#d": [pubkey], limit: 1 }],
            signal,
          ),
        );
        if (!current)
          throw new Error("The managed-agent record no longer exists");
        const content = agentJson(current.content);
        delete content.persona_id;
        content.name_mode = "instance";
        content.name = fallbackName.trim() || String(content.name ?? "");
        const created_at = this.#nextManagementTimestamp(current);
        const event = await this.#sign(
          {
            kind: 30177,
            created_at,
            tags: current.tags.map((tag) => [...tag]),
            content: JSON.stringify(content),
          },
          signal,
        );
        await this.#publish(event, "agent unlink", signal);
        this.#lastManagementAt = created_at;
        return event;
      });
    this.#managementQueue = result;
    return result;
  }

  deletePersona(slug: string, signal?: AbortSignal): Promise<NostrEvent> {
    const result = this.#managementQueue
      .catch(() => undefined)
      .then(async () => {
        if (!AGENT_PERSONA_SLUG.test(slug))
          throw new Error("Invalid persona ID");
        const owner = await this.#options.identity.getPublicKey();
        const created_at = this.#nextManagementTimestamp();
        const event = await this.#sign(
          {
            kind: 5,
            created_at,
            tags: [["a", `30175:${owner}:${slug}`]],
            content: "Deleted agent persona",
          },
          signal,
        );
        await this.#publish(event, "persona deletion", signal);
        this.#lastManagementAt = created_at;
        return event;
      });
    this.#managementQueue = result;
    return result;
  }

  #validateSaveInput(input: CommunityAgentSaveInput): void {
    this.#validatePersonaInput(input);
    if (!AGENT_PUBKEY.test(input.pubkey))
      throw new Error("Invalid agent public key");
    if (input.nameMode !== "inherited" && input.nameMode !== "instance")
      throw new Error("Invalid instance name mode");
    if (input.nameMode === "instance" && !input.instanceName?.trim())
      throw new Error(
        "Instance name is required when it does not inherit the persona name",
      );
  }

  #validatePersonaInput(input: CommunityAgentPersonaSaveInput): void {
    if (!AGENT_PERSONA_SLUG.test(input.personaSlug))
      throw new Error(
        "Persona ID must use lowercase letters, numbers, hyphens, or underscores",
      );
    if (!input.displayName.trim()) throw new Error("Persona name is required");
  }

  async #writePersona(
    input: CommunityAgentPersonaSaveInput,
    head: NostrEvent | undefined,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    const content = safePersonaContent(head?.content);
    content.display_name = input.displayName.trim();
    setOptionalText(content, "description", input.description);
    setOptionalText(content, "avatar_url", input.avatarUrl);
    setOptionalText(content, "system_prompt", input.systemPrompt, false);
    const json = JSON.stringify(content);
    if (new TextEncoder().encode(json).byteLength > 65_535)
      throw new Error("Persona content is larger than 65,535 bytes");
    if (head?.content === json) return head;
    const created_at = this.#nextManagementTimestamp(head);
    const event = await this.#sign(
      {
        kind: 30175,
        created_at,
        tags: head?.tags.map((tag) => [...tag]) ?? [["d", input.personaSlug]],
        content: json,
      },
      signal,
    );
    await this.#publish(event, "persona update", signal);
    this.#lastManagementAt = created_at;
    return event;
  }

  #nextManagementTimestamp(head?: NostrEvent): number {
    const createdAt = Math.max(
      this.#now(),
      (head?.created_at ?? 0) + 1,
      this.#lastManagementAt + 1,
    );
    if (createdAt > this.#now() + 60)
      throw new Error(
        "Agent configuration timestamp is ahead of this device; retry after checking its clock",
      );
    return createdAt;
  }

  async #publish(
    event: NostrEvent,
    label: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.#options.authenticate(signal);
    const result = await this.#options.relay.publish(event, signal);
    if (!result.accepted) throw new Error(`The relay rejected the ${label}`);
  }

  async sendControl(
    agentPubkey: string,
    control: CommunityAgentControl,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    signal?.throwIfAborted();
    if (!AGENT_PUBKEY.test(agentPubkey))
      throw new Error("Agent control requires a valid public key");
    const owner = await this.#options.identity.getPublicKey();
    if (owner === agentPubkey)
      throw new Error("Agent control requires a distinct managed identity");
    const nip44 = this.#options.identity.nip44;
    if (!nip44)
      throw new Error("Agent control requires a signer with NIP-44 support");
    validateAgentControl(control);
    const content = await nip44.encrypt(agentPubkey, JSON.stringify(control));
    signal?.throwIfAborted();
    const event = await this.#sign(
      {
        kind: 24_200,
        created_at: this.#now(),
        tags: [
          ["p", agentPubkey],
          ["agent", agentPubkey],
          ["frame", "control"],
          ...(control.channelId ? [["h", control.channelId]] : []),
        ],
        content,
      },
      signal,
    );
    await this.#publish(event, "agent control", signal);
    return event;
  }
}

const AGENT_PERMISSION_DECISIONS = new Set([
  "allow_once",
  "allow_always",
  "reject_once",
  "reject_always",
  "cancel",
]);

function validateAgentControl(control: CommunityAgentControl): void {
  if (control.version !== 1)
    throw new Error("Unsupported agent control version");
  if (
    control.channelId !== undefined &&
    (!control.channelId.trim() || control.channelId.length > 512)
  )
    throw new Error("Agent control channel is invalid");
  if (
    control.command === "cancel_turn" ||
    control.command === "reset_conversation"
  ) {
    if (!control.scopeKey.trim() || control.scopeKey.length > 4_096)
      throw new Error("Agent control scope is invalid");
    return;
  }
  if (!control.requestId.trim() || control.requestId.length > 512)
    throw new Error("Agent permission request is invalid");
  if (!AGENT_PERMISSION_DECISIONS.has(control.decision))
    throw new Error("Agent permission decision is invalid");
}

const SECRET_PERSONA_FIELDS = new Set([
  "credential",
  "credentials",
  "privatekey",
  "secretkey",
  "secrets",
  "environmentsecrets",
  "envsecrets",
  "envvars",
  "apikey",
  "apikeys",
  "token",
  "tokens",
]);

function safePersonaContent(content?: string): Record<string, unknown> {
  const fields = agentJson(content ?? "{}");
  for (const key of Object.keys(fields)) {
    const normalized = key.toLowerCase().replaceAll(/[_\-.]/g, "");
    if (SECRET_PERSONA_FIELDS.has(normalized)) delete fields[key];
  }
  return fields;
}

function setOptionalText(
  content: Record<string, unknown>,
  key: string,
  value: string | undefined,
  trim = true,
): void {
  const normalized = trim ? value?.trim() : value;
  if (normalized) content[key] = normalized;
  else delete content[key];
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  return AbortSignal.any([
    AbortSignal.timeout(15_000),
    ...(signal ? [signal] : []),
  ]);
}
