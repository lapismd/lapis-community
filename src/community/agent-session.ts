import {
  eventTemplate,
  managedAgentCapability,
} from "./agent-managed-capability.js";
import { sendAgentControl } from "./agent-control-send.js";
import { subscribeAgentEvents } from "./agent-event-subscription.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { matchFilter } from "nostr-tools/filter";
import { BunkerSigner, parseBunkerInput } from "nostr-tools/nip46";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import type { CommunitySigner } from "../auth/index.js";
import { encodeNostrHttpAuthorization } from "../nostr/http-authorization.js";
import type { CommunityRelay, RelayFilter } from "../nostr/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import type { CommunityScope } from "./contracts.js";
import type {
  CommunityAgentCapabilities,
  CommunityAgentControl,
  CommunityAgentControllerBootstrap,
  CommunityAgentDirectory,
  CommunityAgentIdentity,
  CommunityManagedAgentCapability,
  CommunityManagedAgentCreateInput,
  CommunityAgentPersonaSaveInput,
  CommunityAgentSaveInput,
  CommunityAgentSaveResult,
  CommunityAgentSession,
} from "./agent-contracts.js";
import {
  AGENT_PERSONA_SLUG,
  AGENT_PUBKEY,
  agentJson,
  agentOwner,
  agentTag,
  materializeAgentDirectory,
  materializeAgentInstances,
  materializeAgentPersonas,
  newestAgentEvent,
  signedAgentEvent,
} from "./agent-protocol.js";
import { validateAgentControl } from "./agent-control-validation.js";

interface AgentSessionOptions {
  scope: CommunityScope;
  identity: CommunitySigner;
  relay: CommunityRelay;
  authenticate(signal?: AbortSignal): Promise<void>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  connectBunker?: (
    bunkerUrl: string,
    clientSecret: Uint8Array,
  ) => Promise<ManagedBunkerSigner>;
}

interface ManagedBunkerSigner {
  connect(metadata?: { name?: string; url?: string }): Promise<void>;
  getPublicKey(): Promise<string>;
  signEvent(template: NostrEventTemplate): Promise<NostrEvent>;
  close(): Promise<void>;
}

type QueryFilter = RelayFilter & { before_id?: string };
interface RelayInfo {
  self: string;
  capabilities: CommunityAgentCapabilities;
}
interface ManagedAgentDraft {
  fingerprint: string;
  clientSecret: Uint8Array;
  clientPubkey: string;
  idempotencyKey: string;
  profileCreatedAt: number;
}
interface ManagedAgentRecord {
  pubkey: string;
  owner_pubkey: string;
  status: "pending" | "active" | "revoked";
  connection_state: "none" | "pending" | "active" | "replacement_pending";
  created_at: string;
  expires_at: string;
  activated_at?: string;
}
interface ManagedCreateResponse {
  agent: ManagedAgentRecord;
  bunker_url: string;
  profile_template: NostrEventTemplate;
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
  #managedDraft: ManagedAgentDraft | undefined;

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
      lapis_managed_agents?: unknown;
      lapis_runtime_snapshots?: unknown;
    };
    signal?.throwIfAborted();
    const nips = Array.isArray(info.supported_nips) ? info.supported_nips : [];
    const validSelf =
      typeof info.self === "string" && AGENT_PUBKEY.test(info.self);
    // Buzz advertises numeric NIPs, without OA/AO or client-side NIP-44.
    // Probe the bridge; only verified profiles establish owned identities.
    const directory = validSelf && nips.includes(29);
    const managedAgents = managedAgentCapability(
      info.lapis_managed_agents,
      this.#url(),
      validSelf ? (info.self as string) : "",
      nips,
    );
    this.#info = {
      self: validSelf ? (info.self as string) : "",
      capabilities: {
        directory,
        ...(directory && info.lapis_runtime_snapshots === 1
          ? { runtimeSnapshots: true }
          : {}),
        presence: directory,
        activity: directory && (nips.includes("AO") || nips.includes(16)),
        ...(managedAgents ? { managedAgents } : {}),
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

  async #withDeletions(events: readonly NostrEvent[], signal?: AbortSignal) {
    const tombstones: NostrEvent[] = [];
    let partial = false;
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
    return { events: [...events, ...tombstones], partial };
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
    const [owned, personas, membership, contacts, managed] = await Promise.all([
      this.#all({ kinds: [30177], authors: [owner] }, signal),
      this.#all({ kinds: [30175], authors: [owner] }, signal),
      this.#all({ kinds: [39002], authors: [info.self] }, signal),
      this.#query([{ kinds: [3], authors: [owner], limit: 1 }], signal),
      info.capabilities.managedAgents
        ? this.#listManagedAgents(
            info.capabilities.managedAgents,
            signal,
          ).catch(() => [] as ManagedAgentRecord[])
        : Promise.resolve([] as ManagedAgentRecord[]),
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
    const otherOwners = new Set<string>();
    const links = profiles
      .filter((profile) => profile.kind === 0)
      .flatMap((profile) => {
        const managed = profile.tags.find(
          (tag) => tag[0] === "lapis-managed" && tag[2] === info.self,
        );
        const candidate = agentOwner(profile) ?? managed?.[1];
        if (!candidate || candidate === owner || !AGENT_PUBKEY.test(candidate))
          return [];
        otherOwners.add(candidate);
        return [
          {
            kinds: [30177],
            authors: [candidate],
            "#d": [profile.pubkey],
            limit: 1,
          },
        ];
      });
    const publicLinks = await this.#batches(links, signal);
    const events = [
      ...publicLinks,
      ...owned.events,
      ...personas.events,
      ...membership.events,
      ...contacts,
      ...profiles,
    ];
    const resolved = await this.#withDeletions(events, signal);
    const projectedEvents = resolved.events;
    const partial =
      owned.partial ||
      personas.partial ||
      membership.partial ||
      candidateKeys.size > MAX_CANDIDATES ||
      resolved.partial;
    const managedByPubkey = new Map(
      managed.map((record) => [record.pubkey, record]),
    );
    const agents = materializeAgentDirectory(
      projectedEvents,
      owner,
      info.self,
    ).map((agent): CommunityAgentIdentity => {
      const record = managedByPubkey.get(agent.pubkey);
      return record
        ? {
            ...agent,
            custody: {
              kind: "relay-managed",
              state: record.status,
              connectionState: record.connection_state,
              expiresAt: record.expires_at,
              ...(record.activated_at
                ? { activatedAt: record.activated_at }
                : {}),
            },
          }
        : agent;
    });
    return {
      agents,
      publicAgents: [...otherOwners].flatMap((other) =>
        materializeAgentDirectory(projectedEvents, other, info.self),
      ),
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
      onevent(event: NostrEvent, origin?: "live" | "replay"): void;
      onclose(reason: string): void;
    },
    signal?: AbortSignal,
  ): Promise<{ close(): void }> {
    const info = await this.#relayInfo(signal);
    const owner = await this.#options.identity.getPublicKey();
    if (!info.capabilities.directory) return { close() {} };
    await this.#options.authenticate(signal);
    return subscribeAgentEvents(
      this.#options.relay,
      info,
      owner,
      pubkeys,
      handlers,
      this.#now(),
      signal,
    );
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

  createManagedAgent(
    input: CommunityManagedAgentCreateInput,
    signal?: AbortSignal,
  ): Promise<CommunityAgentControllerBootstrap> {
    const result = this.#managementQueue
      .catch(() => undefined)
      .then(async () => {
        this.#validatePersonaInput(input);
        if (input.nameMode !== "inherited" && input.nameMode !== "instance")
          throw new Error("Invalid instance name mode");
        const info = await this.#relayInfo(signal);
        const capability = info.capabilities.managedAgents;
        if (!capability)
          throw new Error(
            "Managed agent creation is unavailable on this relay",
          );
        const owner = await this.#options.identity.getPublicKey();
        const fingerprint = JSON.stringify({
          personaSlug: input.personaSlug,
          displayName: input.displayName,
          description: input.description ?? "",
          avatarUrl: input.avatarUrl ?? "",
          systemPrompt: input.systemPrompt ?? "",
          nameMode: input.nameMode,
          instanceName: input.instanceName ?? "",
        });
        if (this.#managedDraft?.fingerprint !== fingerprint) {
          this.clearManagedAgentDraft();
          const clientSecret = generateSecretKey();
          this.#managedDraft = {
            fingerprint,
            clientSecret,
            clientPubkey: getPublicKey(clientSecret),
            idempotencyKey: crypto.randomUUID(),
            profileCreatedAt: this.#now(),
          };
        }
        const draft = this.#managedDraft;
        const profileContent = JSON.stringify({
          name: input.displayName.trim(),
          ...(input.description?.trim()
            ? { about: input.description.trim() }
            : {}),
          ...(input.avatarUrl?.trim()
            ? { picture: input.avatarUrl.trim() }
            : {}),
        });
        const created = await this.#managedRequest<ManagedCreateResponse>(
          capability.provisioningUrl,
          "POST",
          {
            client_pubkey: draft.clientPubkey,
            profile_content: profileContent,
            profile_created_at: draft.profileCreatedAt,
            idempotency_key: draft.idempotencyKey,
          },
          signal,
        );
        if (
          !managedAgentRecord(created.agent) ||
          !AGENT_PUBKEY.test(created.agent.pubkey) ||
          typeof created.bunker_url !== "string" ||
          !eventTemplate(created.profile_template)
        )
          throw new Error("The relay returned an invalid managed-agent draft");
        let bunker: ManagedBunkerSigner | undefined;
        try {
          bunker = await this.#bunker(created.bunker_url, draft.clientSecret);
          await bunker.connect({ name: "Lapis Community" });
          if ((await bunker.getPublicKey()) !== created.agent.pubkey)
            throw new Error(
              "The managed signer returned a different agent key",
            );
          const profile = signedAgentEvent(
            await bunker.signEvent(created.profile_template),
          );
          if (
            !profile ||
            profile.pubkey !== created.agent.pubkey ||
            profile.kind !== 0 ||
            JSON.stringify(profile.tags) !==
              JSON.stringify(created.profile_template.tags) ||
            profile.content !== created.profile_template.content ||
            profile.created_at !== created.profile_template.created_at
          )
            throw new Error("The managed signer returned an invalid profile");
          const personaHead = newestAgentEvent(
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
          await this.#writePersona(input, personaHead, signal);
          const createdAt = this.#nextManagementTimestamp();
          const instance = await this.#sign(
            {
              kind: 30177,
              created_at: createdAt,
              tags: [["d", created.agent.pubkey]],
              content: JSON.stringify({
                persona_id: input.personaSlug,
                name_mode: input.nameMode,
                name: input.instanceName?.trim() || input.displayName.trim(),
                respond_to: "members",
                parallelism: 1,
              }),
            },
            signal,
          );
          await this.#managedRequest(
            `${capability.provisioningUrl}/${created.agent.pubkey}/activate`,
            "POST",
            { owner_event: instance, profile_event: profile },
            signal,
          );
          this.#lastManagementAt = createdAt;
          const bootstrap = this.#bootstrap(
            capability,
            created.agent.pubkey,
            owner,
            input.personaSlug,
            input.systemPrompt ?? "",
            created.bunker_url,
            bytesToHex(draft.clientSecret),
            created.agent.expires_at,
            [],
            [...(input.groupIds ?? [])],
          );
          this.clearManagedAgentDraft();
          return bootstrap;
        } finally {
          try {
            await bunker?.close();
          } catch {
            // The activation result remains authoritative if transport cleanup fails.
          }
        }
      });
    this.#managementQueue = result;
    return result;
  }

  clearManagedAgentDraft(): void {
    this.#managedDraft?.clientSecret.fill(0);
    this.#managedDraft = undefined;
  }

  async createManagedAgentReplacement(
    pubkey: string,
    signal?: AbortSignal,
  ): Promise<CommunityAgentControllerBootstrap> {
    if (!AGENT_PUBKEY.test(pubkey)) throw new Error("Invalid agent public key");
    const info = await this.#relayInfo(signal);
    const capability = info.capabilities.managedAgents;
    if (!capability)
      throw new Error("Managed controller setup is unavailable on this relay");
    const directory = await this.loadDirectory(signal);
    const agent = directory.agents.find(
      (candidate) => candidate.pubkey === pubkey && candidate.custody,
    );
    if (!agent) throw new Error("The managed agent is no longer available");
    const owner = await this.#options.identity.getPublicKey();
    const clientSecret = generateSecretKey();
    try {
      const response = await this.#managedRequest<{
        bunker_url: string;
        expires_at: string;
      }>(
        `${capability.provisioningUrl}/${pubkey}/connections`,
        "POST",
        {
          client_pubkey: getPublicKey(clientSecret),
          idempotency_key: crypto.randomUUID(),
        },
        signal,
      );
      if (
        typeof response.bunker_url !== "string" ||
        typeof response.expires_at !== "string"
      )
        throw new Error("The relay returned an invalid replacement setup");
      return this.#bootstrap(
        capability,
        pubkey,
        owner,
        agent.persona?.slug ?? agent.instance?.personaId ?? "agent",
        agent.persona?.systemPrompt ?? "",
        response.bunker_url,
        bytesToHex(clientSecret),
        response.expires_at,
        [...agent.channelIds],
        [],
      );
    } finally {
      clientSecret.fill(0);
    }
  }

  async revokeManagedAgent(
    pubkey: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const capability = (await this.#relayInfo(signal)).capabilities
      .managedAgents;
    if (!capability)
      throw new Error("Managed controller access is unavailable on this relay");
    await this.#managedRequest(
      `${capability.provisioningUrl}/${pubkey}/connections/current`,
      "DELETE",
      undefined,
      signal,
    );
  }

  async deleteManagedAgent(
    pubkey: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!AGENT_PUBKEY.test(pubkey)) throw new Error("Invalid agent public key");
    const info = await this.#relayInfo(signal);
    const capability = info.capabilities.managedAgents;
    if (!capability)
      throw new Error("Managed agent deletion is unavailable on this relay");
    const owner = await this.#options.identity.getPublicKey();
    const unlink = await this.#sign(
      {
        kind: 5,
        created_at: this.#nextManagementTimestamp(),
        tags: [["a", `30177:${owner}:${pubkey}`]],
        content: "Deleted relay-managed agent",
      },
      signal,
    );
    await this.#managedRequest(
      `${capability.provisioningUrl}/${pubkey}`,
      "DELETE",
      { unlink_event: unlink },
      signal,
    );
    this.#lastManagementAt = unlink.created_at;
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

        const definitions = await this.#all(
          { kinds: [30177], authors: [owner] },
          signal,
        );
        const resolved = await this.#withDeletions(definitions.events, signal);
        const shared =
          definitions.partial ||
          resolved.partial ||
          materializeAgentInstances(resolved.events, owner).some(
            (instance) =>
              instance.agentPubkey !== input.pubkey &&
              instance.personaId === input.personaSlug,
          );
        const slug = shared
          ? `agent-${input.pubkey.slice(0, 16)}-${crypto.randomUUID().slice(0, 8)}`
          : input.personaSlug;
        const persona = await this.#writePersona(
          { ...input, personaSlug: slug },
          personaHead,
          signal,
          shared,
        );

        const instanceContent = agentJson(instanceHead?.content ?? "{}");
        instanceContent.persona_id = slug;
        if (input.dmAllowlist !== undefined)
          instanceContent.dm_allowlist = [...new Set(input.dmAllowlist)]
            .filter((key) => key !== owner && key !== input.pubkey)
            .sort();
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
        const definitions = await this.#all(
          { kinds: [30177], authors: [owner] },
          signal,
        );
        const resolved = await this.#withDeletions(definitions.events, signal);
        if (definitions.partial || resolved.partial)
          throw new Error(
            "Could not verify all agent links. Refresh and retry deleting this setup.",
          );
        if (
          materializeAgentInstances(resolved.events, owner).some(
            (instance) => instance.personaId === slug,
          )
        )
          throw new Error(
            "This saved setup is still linked to an agent. Edit that agent instead.",
          );
        const created_at = this.#nextManagementTimestamp();
        const event = await this.#sign(
          {
            kind: 5,
            created_at,
            tags: [["a", `30175:${owner}:${slug}`]],
            content: "Deleted saved agent setup",
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
    if (
      input.dmAllowlist !== undefined &&
      (input.dmAllowlist.length > 128 ||
        input.dmAllowlist.some((key) => !AGENT_PUBKEY.test(key)))
    )
      throw new Error(
        "Approved messaging participants must be at most 128 hexadecimal public keys",
      );
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
    copy = false,
  ): Promise<NostrEvent> {
    const content = safePersonaContent(head?.content);
    content.display_name = input.displayName.trim();
    setOptionalText(content, "description", input.description);
    setOptionalText(content, "avatar_url", input.avatarUrl);
    setOptionalText(content, "system_prompt", input.systemPrompt, false);
    const json = JSON.stringify(content);
    if (new TextEncoder().encode(json).byteLength > 65_535)
      throw new Error("Persona content is larger than 65,535 bytes");
    if (!copy && head?.content === json) return head;
    const created_at = this.#nextManagementTimestamp(head);
    const event = await this.#sign(
      {
        kind: 30175,
        created_at,
        tags: copy
          ? [
              ["d", input.personaSlug],
              ...(head?.tags
                .filter(([name]) => name !== "d")
                .map((tag) => [...tag]) ?? []),
            ]
          : (head?.tags.map((tag) => [...tag]) ?? [["d", input.personaSlug]]),
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

  async #listManagedAgents(
    capability: CommunityManagedAgentCapability,
    signal?: AbortSignal,
  ): Promise<ManagedAgentRecord[]> {
    const result = await this.#managedRequest<{ agents?: unknown }>(
      capability.provisioningUrl,
      "GET",
      undefined,
      signal,
    );
    if (!Array.isArray(result.agents))
      throw new Error("The relay returned an invalid managed-agent list");
    return result.agents.filter(managedAgentRecord);
  }

  async #managedRequest<T = unknown>(
    url: string,
    method: "GET" | "POST" | "DELETE",
    input?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const body = input === undefined ? "" : JSON.stringify(input);
    const tags = [
      ["u", url],
      ["method", method],
      ["nonce", crypto.randomUUID()],
    ];
    if (method !== "GET")
      tags.push([
        "payload",
        bytesToHex(sha256(new TextEncoder().encode(body))),
      ]);
    const auth = await this.#sign(
      { kind: 27235, created_at: this.#now(), tags, content: "" },
      signal,
    );
    const response = await this.#fetch(url, {
      method,
      headers: {
        Authorization: encodeNostrHttpAuthorization(auth),
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(method === "GET" ? {} : { body }),
      signal: requestSignal(signal),
    });
    if (!response.ok) {
      let reason = `Managed agent request failed (${response.status})`;
      try {
        const value = (await response.json()) as { error?: unknown };
        if (typeof value.error === "string") reason = value.error;
      } catch {
        // The status remains sufficient when a proxy returns a non-JSON error.
      }
      throw new Error(reason.replaceAll("_", " "));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async #bunker(
    bunkerUrl: string,
    clientSecret: Uint8Array,
  ): Promise<ManagedBunkerSigner> {
    if (this.#options.connectBunker)
      return await this.#options.connectBunker(bunkerUrl, clientSecret);
    const pointer = await parseBunkerInput(bunkerUrl);
    if (!pointer) throw new Error("The relay returned an invalid bunker URL");
    return BunkerSigner.fromBunker(clientSecret, pointer);
  }

  #bootstrap(
    capability: CommunityManagedAgentCapability,
    pubkey: string,
    ownerPubkey: string,
    persona: string,
    prompt: string,
    bunkerUrl: string,
    clientSecret: string,
    invitationExpiresAt: string,
    confirmedGroups: string[],
    remainingGroups: string[],
  ): CommunityAgentControllerBootstrap {
    const prefix = pubkey.slice(0, 12).toUpperCase();
    const id = `agent-${pubkey.slice(0, 12)}`;
    const bunkerUrlEnv = `LAPIS_AGENT_${prefix}_BUNKER_URL`;
    const clientSecretEnv = `LAPIS_AGENT_${prefix}_NIP46_CLIENT_SECRET`;
    return {
      schema: "lapis.agent-controller-bootstrap/1",
      relay: {
        id: "main",
        url: this.#options.scope.relayUrl,
        pubkey: capability.relayPubkey,
      },
      agent: { id, pubkey, ownerPubkey, persona, prompt },
      ownerAuthorization: {
        kind: "lapis-managed-v1",
        relayPubkey: capability.relayPubkey,
      },
      signer: { id, kind: "nip46", bunkerUrlEnv, clientSecretEnv },
      environment: {
        [bunkerUrlEnv]: bunkerUrl,
        [clientSecretEnv]: clientSecret,
      },
      confirmedGroups,
      controllerDefaults: { respondTo: "members", enabled: true },
      requiredLocalChoices: {
        hostId: null,
        runtimeAgent: null,
        remainingGroups,
      },
      custody: { state: "active", invitationExpiresAt },
    };
  }

  async loadRuntimeHeads(
    agent: string,
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]> {
    const owner = await this.#options.identity.getPublicKey();
    return this.#query(
      [
        {
          kinds: [30180],
          authors: [agent],
          "#d": [owner],
          "#p": [owner],
          limit: 1,
        },
        {
          kinds: [30181],
          authors: [owner],
          "#d": [agent],
          "#p": [agent],
          limit: 1,
        },
      ],
      signal,
    );
  }
  async sendRuntimeRequest(
    agent: string,
    request: import("./agent-runtime-snapshot-protocol.js").RuntimeRefreshRequest,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    if (!AGENT_PUBKEY.test(agent) || !this.#options.identity.nip44)
      throw new Error("Runtime refresh requires an agent and NIP-44 signer");
    const content = await this.#options.identity.nip44.encrypt(
      agent,
      JSON.stringify(request),
    );
    const event = await this.#sign(
      {
        kind: 30181,
        created_at: Math.floor(request.requestedAt / 1000),
        tags: [
          ["p", agent],
          ["agent", agent],
          ["d", agent],
        ],
        content,
      },
      signal,
    );
    await this.#publish(event, "runtime refresh", signal);
    return event;
  }

  sendControl(
    agent: string,
    control: CommunityAgentControl,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    return sendAgentControl(
      {
        identity: this.#options.identity,
        now: () => this.#now(),
        sign: (value, signal) => this.#sign(value, signal),
        publish: (event, label, signal) => this.#publish(event, label, signal),
      },
      agent,
      control,
      signal,
    );
  }
}

function managedAgentRecord(input: unknown): input is ManagedAgentRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return (
    typeof value.pubkey === "string" &&
    AGENT_PUBKEY.test(value.pubkey) &&
    typeof value.owner_pubkey === "string" &&
    AGENT_PUBKEY.test(value.owner_pubkey) &&
    (value.status === "pending" ||
      value.status === "active" ||
      value.status === "revoked") &&
    (value.connection_state === "none" ||
      value.connection_state === "pending" ||
      value.connection_state === "active" ||
      value.connection_state === "replacement_pending") &&
    typeof value.created_at === "string" &&
    typeof value.expires_at === "string" &&
    (value.activated_at === undefined || typeof value.activated_at === "string")
  );
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
