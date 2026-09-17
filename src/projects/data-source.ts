import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  authenticateRegistryRelay,
  type RegistrySigner,
} from "../auth/index.js";
import {
  encodeNostrHttpAuthorization,
  type CommunityRelay,
  type CommunityRelayFactory,
  type CommunityRelaySubscription,
  type RelayFilter,
} from "../nostr/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import {
  PROJECT_FORGE_KINDS,
  allTagValues,
  type ProjectForgeBlobResponse,
  type ProjectForgeAttachGitHubRepositoryInput,
  type ProjectForgeCatalog,
  type ProjectForgeCommitResponse,
  type ProjectForgeCommitsOptions,
  type ProjectForgeCommitsResponse,
  type ProjectForgeGitHubConnectionsResponse,
  type ProjectForgeGitHubConnection,
  type ProjectForgeGitHubConnectionInput,
  type ProjectForgeGitHubRepositoriesResponse,
  type ProjectForgeOperation,
  type ProjectForgeProgress,
  type ProjectForgePullRequestDiff,
  type ProjectForgeRepositoryCapabilitiesResponse,
  type ProjectForgeRepositoryIntegrationResponse,
  type ProjectForgeRefsResponse,
  type ProjectForgeTreeResponse,
  type ProjectForgeWorkItems,
} from "./model.js";
import { loadProjectForgeRefs } from "./repository-refs.js";
import { buzzWorkItemFilters } from "./work-item-filters.js";
import {
  materializeProjectForgeCatalog,
  materializeProjectForgeWorkItems,
} from "./reducer.js";

const PROJECT_PAGE_SIZE = 500;
const WORK_ITEM_LIMIT = 2_000;
const TOMBSTONE_CHUNK_SIZE = 100;
const PROJECT_FORGE_READ_CACHE_TTL_MS = 15_000;
const PROJECT_FORGE_READ_CACHE_MAX_ENTRIES = 256;
const PROJECT_FORGE_OPERATION_POLL_MS = 250;
const PROJECT_FORGE_OPERATION_MAX_POLLS = 120;

interface ProjectForgeReadCacheEntry {
  expiresAt: number;
  value: unknown;
}

function githubConnectionRequest(input: ProjectForgeGitHubConnectionInput) {
  return {
    app_id: input.appId,
    installation_id: input.installationId,
    credential_ref: input.credentialRef,
    webhook_secret_ref: input.webhookSecretRef,
    bridge_credential_ref: input.bridgeCredentialRef,
    bridge_pubkey: input.bridgePubkey,
  };
}

export interface ProjectForgeDataSourceContext {
  relayUrl: string;
  identity?: RegistrySigner;
  /** Defaults to the HTTP(S) origin derived from relayUrl. */
  httpBaseUrl?: string | URL;
}

export interface ProjectForgeDataSourceOptions {
  relayFactory: CommunityRelayFactory;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
}

export interface ProjectForgeSourceEvent {
  type: "event" | "eose" | "close";
  event?: NostrEvent;
  reason?: string;
}

export interface ProjectForgeSession {
  readonly relayUrl: string;
  loadCatalog(
    channelId?: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeCatalog>;
  loadWorkItems(
    repository: NostrEvent,
    signal?: AbortSignal,
  ): Promise<ProjectForgeWorkItems>;
  publish(
    template: NostrEventTemplate,
    signal?: AbortSignal,
  ): Promise<NostrEvent>;
  publishMany(
    templates: readonly NostrEventTemplate[],
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]>;
  publishHttp(
    template: NostrEventTemplate,
    signal?: AbortSignal,
  ): Promise<NostrEvent>;
  queryHttp(
    filters: readonly RelayFilter[],
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]>;
  subscribe(
    filters: readonly RelayFilter[],
    listener: (event: ProjectForgeSourceEvent) => void,
    signal?: AbortSignal,
  ): Promise<() => void>;
  loadCapabilities(
    repository: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeRepositoryCapabilitiesResponse>;
  loadGitHubConnections(
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubConnectionsResponse>;
  createGitHubConnection(
    input: ProjectForgeGitHubConnectionInput,
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubConnection>;
  updateGitHubConnection(
    connectionId: string,
    input: ProjectForgeGitHubConnectionInput,
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubConnection>;
  revalidateGitHubConnection(
    connectionId: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubConnection>;
  loadGitHubRepositories(
    connectionId: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubRepositoriesResponse>;
  attachGitHubRepository(
    repository: string,
    input: ProjectForgeAttachGitHubRepositoryInput,
    signal?: AbortSignal,
  ): Promise<ProjectForgeRepositoryIntegrationResponse>;
  loadRefs(
    repository: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeRefsResponse>;
  loadTree(
    repository: string,
    revision: string,
    path?: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeTreeResponse>;
  loadBlob(
    repository: string,
    revision: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeBlobResponse>;
  loadCommits(
    repository: string,
    ref?: string,
    signal?: AbortSignal,
    options?: ProjectForgeCommitsOptions,
  ): Promise<ProjectForgeCommitsResponse>;
  loadCommit(
    repository: string,
    sha: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeCommitResponse>;
  loadPullRequestDiff(
    eventId: string,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: ProjectForgeProgress) => void;
    },
  ): Promise<ProjectForgePullRequestDiff>;
  mergePullRequest(
    eventId: string,
    expectedHead: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeOperation>;
  close(): void;
}

export interface ProjectForgeDataSource {
  open(
    context: ProjectForgeDataSourceContext,
    signal?: AbortSignal,
  ): Promise<ProjectForgeSession>;
}

export function createNip34ProjectForgeDataSource(
  options: ProjectForgeDataSourceOptions,
): ProjectForgeDataSource {
  const readCache = new Map<string, ProjectForgeReadCacheEntry>();
  return {
    async open(context, signal) {
      signal?.throwIfAborted();
      const relay = options.relayFactory.create(context.relayUrl);
      try {
        const request = options.fetch ?? globalThis.fetch.bind(globalThis);
        const now = options.now ?? (() => new Date());
        if (context.identity) {
          await authenticateRegistryRelay(relay, context.identity, signal);
        }
        const cacheIdentity = context.identity
          ? await context.identity.getPublicKey()
          : "anonymous";
        signal?.throwIfAborted();
        return new Nip34ProjectForgeSession(
          relay,
          context,
          request,
          now,
          readCache,
          cacheIdentity,
        );
      } catch (cause) {
        relay.close();
        throw cause;
      }
    },
  };
}

class Nip34ProjectForgeSession implements ProjectForgeSession {
  readonly relayUrl: string;
  readonly #relay: CommunityRelay;
  readonly #context: ProjectForgeDataSourceContext;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #readCache: Map<string, ProjectForgeReadCacheEntry>;
  readonly #cacheIdentity: string;
  readonly #subscriptions = new Set<CommunityRelaySubscription>();
  #closed = false;

  constructor(
    relay: CommunityRelay,
    context: ProjectForgeDataSourceContext,
    request: typeof globalThis.fetch,
    now: () => Date,
    readCache: Map<string, ProjectForgeReadCacheEntry>,
    cacheIdentity: string,
  ) {
    this.relayUrl = relay.url;
    this.#relay = relay;
    this.#context = context;
    this.#fetch = request;
    this.#now = now;
    this.#readCache = readCache;
    this.#cacheIdentity = cacheIdentity;
  }

  async loadCatalog(
    channelId?: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeCatalog> {
    this.#assertOpen(signal);
    const events = await this.#queryPages(
      {
        kinds: [PROJECT_FORGE_KINDS.project, PROJECT_FORGE_KINDS.repository],
        ...(channelId ? { "#buzz-channel": [channelId] } : {}),
      } as RelayFilter,
      PROJECT_PAGE_SIZE,
      signal,
    );
    const coordinates = events.flatMap((event) => {
      const identifier = event.tags.find((tag) => tag[0] === "d")?.[1];
      return identifier ? [`${event.kind}:${event.pubkey}:${identifier}`] : [];
    });
    const tombstones = await this.#loadTombstonesByAddress(coordinates, signal);
    return materializeProjectForgeCatalog([...events, ...tombstones]);
  }

  async loadWorkItems(
    repository: NostrEvent,
    signal?: AbortSignal,
  ): Promise<ProjectForgeWorkItems> {
    this.#assertOpen(signal);
    const identifier = repository.tags.find((tag) => tag[0] === "d")?.[1];
    if (repository.kind !== PROJECT_FORGE_KINDS.repository || !identifier) {
      throw new Error("Work items require a kind 30617 repository event");
    }
    const coordinate = `${repository.kind}:${repository.pubkey}:${identifier}`;
    const filters = buzzWorkItemFilters(coordinate);
    const bundles = await Promise.all(
      filters.map((filter) => this.#relay.query(filter, signal)),
    );
    const roots = bundles[0] ?? [];
    const rootIds = roots.map((event) => event.id);
    const nip22 = await this.#queryByEventIds(
      PROJECT_FORGE_KINDS.comment,
      "#E",
      rootIds,
      signal,
    );
    const tombstones = await this.#queryByEventIds(
      PROJECT_FORGE_KINDS.deletion,
      "#e",
      [
        ...rootIds,
        ...bundles.flat().map((event) => event.id),
        ...nip22.map((event) => event.id),
      ],
      signal,
    );
    return materializeProjectForgeWorkItems(
      repository,
      [...bundles.flat(), ...nip22, ...tombstones],
      this.#cacheIdentity === "anonymous" ? undefined : this.#cacheIdentity,
    );
  }

  async publish(
    template: NostrEventTemplate,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    this.#assertOpen(signal);
    const identity = this.#requiredIdentity();
    const event = await identity.signEvent(cloneTemplate(template));
    const result = await this.#relay.publish(event, signal);
    if (!result.accepted)
      throw new Error(result.message || "The relay rejected the event");
    return event;
  }

  async publishMany(
    templates: readonly NostrEventTemplate[],
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]> {
    const published: NostrEvent[] = [];
    for (const template of templates)
      published.push(await this.publish(template, signal));
    return published;
  }

  async publishHttp(
    template: NostrEventTemplate,
    signal?: AbortSignal,
  ): Promise<NostrEvent> {
    this.#assertOpen(signal);
    const event = await this.#requiredIdentity().signEvent(
      cloneTemplate(template),
    );
    const response = await this.#authenticatedJsonRequest(
      "/events",
      event,
      signal,
    );
    const result = (await response.json()) as {
      accepted?: boolean;
      message?: string;
    };
    if (!result.accepted)
      throw new Error(result.message || "The relay rejected the event");
    return event;
  }

  async queryHttp(
    filters: readonly RelayFilter[],
    signal?: AbortSignal,
  ): Promise<readonly NostrEvent[]> {
    this.#assertOpen(signal);
    const response = await this.#authenticatedJsonRequest(
      "/query",
      filters,
      signal,
    );
    return (await response.json()) as NostrEvent[];
  }

  async subscribe(
    filters: readonly RelayFilter[],
    listener: (event: ProjectForgeSourceEvent) => void,
    signal?: AbortSignal,
  ): Promise<() => void> {
    this.#assertOpen(signal);
    const created = await Promise.all(
      filters.map(async (filter) => {
        const subscription = await this.#relay.subscribe(
          filter,
          {
            onevent: (event) => listener({ type: "event", event }),
            oneose: () => listener({ type: "eose" }),
            onclose: (reason) => listener({ type: "close", reason }),
          },
          signal,
        );
        this.#subscriptions.add(subscription);
        return subscription;
      }),
    );
    return () => {
      for (const subscription of created) {
        subscription.close("project forge subscription closed");
        this.#subscriptions.delete(subscription);
      }
    };
  }

  async loadRefs(
    repository: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeRefsResponse> {
    // prettier-ignore
    return await loadProjectForgeRefs((s) => this.#forgeGet(repository, s, signal));
  }

  async loadCapabilities(
    repository: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeRepositoryCapabilitiesResponse> {
    const address = repositoryAddress(repository);
    const response =
      await this.#strictGet<ProjectForgeRepositoryCapabilitiesResponse>(
        `/api/forge/repositories/${address.owner}/${encodeURIComponent(address.identifier)}/capabilities`,
        signal === undefined ? {} : { signal },
      );
    if (response.repository !== repository) {
      throw new Error(
        "Repository capability response does not match the request",
      );
    }
    return response;
  }

  async loadGitHubConnections(
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubConnectionsResponse> {
    return await this.#forgeJsonRequest(
      "GET",
      "/api/forge/connections/github",
      undefined,
      signal,
    );
  }

  async createGitHubConnection(
    input: ProjectForgeGitHubConnectionInput,
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubConnection> {
    return await this.#forgeJsonRequest(
      "POST",
      "/api/forge/connections/github",
      githubConnectionRequest(input),
      signal,
    );
  }

  async updateGitHubConnection(
    connectionId: string,
    input: ProjectForgeGitHubConnectionInput,
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubConnection> {
    return await this.#forgeJsonRequest(
      "PUT",
      `/api/forge/connections/github/${encodeURIComponent(connectionId)}`,
      githubConnectionRequest(input),
      signal,
    );
  }

  async revalidateGitHubConnection(
    connectionId: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubConnection> {
    return await this.#forgeJsonRequest(
      "POST",
      `/api/forge/connections/github/${encodeURIComponent(connectionId)}/revalidate`,
      undefined,
      signal,
    );
  }

  async loadGitHubRepositories(
    connectionId: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeGitHubRepositoriesResponse> {
    return await this.#forgeJsonRequest(
      "GET",
      `/api/forge/connections/github/${encodeURIComponent(connectionId)}/repositories`,
      undefined,
      signal,
    );
  }

  async attachGitHubRepository(
    repository: string,
    input: ProjectForgeAttachGitHubRepositoryInput,
    signal?: AbortSignal,
  ): Promise<ProjectForgeRepositoryIntegrationResponse> {
    const address = repositoryAddress(repository);
    return await this.#forgeJsonRequest(
      "PUT",
      `/api/forge/repositories/${address.owner}/${encodeURIComponent(address.identifier)}/integration`,
      {
        expected_announcement_id: input.expectedAnnouncementId,
        git_authority_backend: "github",
        content_backend: "github",
        collaboration_backend: "relay",
        connection_id: input.connectionId,
        external_repository_id: input.externalRepositoryId,
      },
      signal,
    );
  }

  async loadTree(
    repository: string,
    revision: string,
    path = "",
    signal?: AbortSignal,
  ): Promise<ProjectForgeTreeResponse> {
    const response = await this.#forgeGet<
      Omit<ProjectForgeTreeResponse, "readme"> & {
        readme?: string | { name?: string; contents?: string } | null;
      }
    >(repository, `tree/${encodePath(revision)}/${encodePath(path)}`, signal);
    const readme =
      typeof response.readme === "string"
        ? response.readme
        : response.readme?.contents;
    return {
      ref: response.ref,
      sha: response.sha,
      path: response.path,
      entries: response.entries,
      ...(response.commit === undefined ? {} : { commit: response.commit }),
      ...(typeof readme === "string" ? { readme } : {}),
    };
  }

  async loadBlob(
    repository: string,
    revision: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeBlobResponse> {
    return await this.#forgeGet(
      repository,
      `blob/${encodePath(revision)}/${encodePath(path)}`,
      signal,
    );
  }

  async loadCommits(
    repository: string,
    ref?: string,
    signal?: AbortSignal,
    options: ProjectForgeCommitsOptions = {},
  ): Promise<ProjectForgeCommitsResponse> {
    const query = new URLSearchParams();
    if (ref) query.set("ref", ref);
    if (options.path) query.set("path", options.path);
    if (options.limit !== undefined) query.set("n", String(options.limit));
    const suffix = query.size > 0 ? `commits?${query.toString()}` : "commits";
    return await this.#forgeGet(repository, suffix, signal);
  }

  async loadCommit(
    repository: string,
    sha: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeCommitResponse> {
    return await this.#forgeGet(
      repository,
      `commit/${encodeURIComponent(sha)}`,
      signal,
    );
  }

  async loadPullRequestDiff(
    eventId: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: ProjectForgeProgress) => void;
    } = {},
  ): Promise<ProjectForgePullRequestDiff> {
    if (!/^[0-9a-f]{64}$/u.test(eventId))
      throw new Error("Invalid pull request event ID");
    return await this.#strictGet(`/api/pull-requests/${eventId}/diff`, options);
  }

  async mergePullRequest(
    eventId: string,
    expectedHead: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeOperation> {
    if (!/^[0-9a-f]{64}$/u.test(eventId))
      throw new Error("Invalid pull request event ID");
    if (!/^[0-9a-f]{40,64}$/u.test(expectedHead))
      throw new Error("Invalid pull request head");
    let operation = await this.#forgeJsonRequest<ProjectForgeOperation>(
      "POST",
      `/api/forge/pull-requests/${eventId}/merge`,
      { expected_head: expectedHead, method: "merge" },
      signal,
    );
    for (let poll = 0; poll <= PROJECT_FORGE_OPERATION_MAX_POLLS; poll += 1) {
      if (operation.state === "complete") return operation;
      if (operation.state === "failed")
        throw new Error(operation.failure || "Pull request merge failed");
      if (poll === PROJECT_FORGE_OPERATION_MAX_POLLS)
        throw new Error("Pull request merge is still pending");
      await abortableDelay(PROJECT_FORGE_OPERATION_POLL_MS, signal);
      operation = await this.#strictGet<ProjectForgeOperation>(
        `/api/forge/operations/${encodeURIComponent(operation.operation_id)}`,
        { ...(signal === undefined ? {} : { signal }), cache: false },
      );
    }
    return operation;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const subscription of this.#subscriptions)
      subscription.close("project forge closed");
    this.#subscriptions.clear();
    this.#relay.close();
  }

  async #queryPages(
    baseFilter: RelayFilter,
    limit: number,
    signal?: AbortSignal,
  ): Promise<NostrEvent[]> {
    const events = new Map<string, NostrEvent>();
    let cursor: { createdAt: number; eventId: string } | undefined;
    for (;;) {
      const filter = {
        ...baseFilter,
        limit,
        ...(cursor
          ? { until: cursor.createdAt, before_id: cursor.eventId }
          : {}),
      } as RelayFilter;
      const page = await this.#relay.query(filter, signal);
      for (const event of page) events.set(event.id, event);
      if (page.length < limit) break;
      const last = page.at(-1)!;
      const next = { createdAt: last.created_at, eventId: last.id };
      if (
        cursor?.createdAt === next.createdAt &&
        cursor.eventId === next.eventId
      )
        break;
      cursor = next;
    }
    return [...events.values()];
  }

  async #loadTombstonesByAddress(
    coordinates: readonly string[],
    signal?: AbortSignal,
  ): Promise<NostrEvent[]> {
    const chunks = chunk([...new Set(coordinates)], TOMBSTONE_CHUNK_SIZE);
    return distinctEvents(
      (
        await Promise.all(
          chunks.map((values) =>
            this.#relay.query(
              {
                kinds: [PROJECT_FORGE_KINDS.deletion],
                "#a": values,
                limit: WORK_ITEM_LIMIT,
              },
              signal,
            ),
          ),
        )
      ).flat(),
    );
  }

  async #queryByEventIds(
    kind: number,
    tag: "#e" | "#E",
    ids: readonly string[],
    signal?: AbortSignal,
  ): Promise<NostrEvent[]> {
    const chunks = chunk([...new Set(ids)], TOMBSTONE_CHUNK_SIZE);
    return distinctEvents(
      (
        await Promise.all(
          chunks.map((values) =>
            this.#relay.query(
              {
                kinds: [kind],
                [tag]: values,
                limit: WORK_ITEM_LIMIT,
              } as unknown as RelayFilter,
              signal,
            ),
          ),
        )
      ).flat(),
    );
  }

  async #forgeGet<T>(
    coordinate: string,
    suffix: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const address = repositoryAddress(coordinate);
    // prettier-ignore
    return await this.#strictGet(`/api/git/${address.owner}/${encodeURIComponent(address.identifier)}/${suffix}`, signal === undefined ? {} : { signal });
  }

  async #strictGet<T>(
    path: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: ProjectForgeProgress) => void;
      cache?: boolean;
    },
  ): Promise<T> {
    this.#assertOpen(options.signal);
    const identity = this.#requiredIdentity();
    const url = new URL(path, this.#httpBaseUrl());
    const cacheKey = `${this.#cacheIdentity}:${url.toString()}`;
    const cacheable =
      options.onProgress === undefined && options.cache !== false;
    if (cacheable) {
      const cached = this.#readCache.get(cacheKey);
      if (cached && cached.expiresAt > this.#now().getTime()) {
        this.#readCache.delete(cacheKey);
        this.#readCache.set(cacheKey, cached);
        return cached.value as T;
      }
      if (cached) this.#readCache.delete(cacheKey);
    }
    const auth = await identity.signEvent({
      kind: PROJECT_FORGE_KINDS.httpAuth,
      created_at: Math.floor(this.#now().getTime() / 1_000),
      content: "",
      tags: [
        ["u", url.toString()],
        ["method", "GET"],
        ["nonce", randomNonce()],
      ],
    });
    const response = await this.#fetch(url, {
      method: "GET",
      headers: { Authorization: encodeNostrHttpAuthorization(auth) },
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    if (!response.ok) throw await responseError(response);
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      return parseSseResult<T>(await response.text(), options.onProgress);
    }
    const value = (await response.json()) as T;
    if (cacheable) {
      this.#readCache.set(cacheKey, {
        expiresAt: this.#now().getTime() + PROJECT_FORGE_READ_CACHE_TTL_MS,
        value,
      });
      while (this.#readCache.size > PROJECT_FORGE_READ_CACHE_MAX_ENTRIES) {
        const oldestKey = this.#readCache.keys().next().value;
        if (oldestKey === undefined) break;
        this.#readCache.delete(oldestKey);
      }
    }
    return value;
  }

  async #authenticatedJsonRequest(
    path: string,
    value: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const body = JSON.stringify(value);
    const url = new URL(path, this.#httpBaseUrl());
    const auth = await this.#requiredIdentity().signEvent({
      kind: PROJECT_FORGE_KINDS.httpAuth,
      created_at: Math.floor(this.#now().getTime() / 1_000),
      content: "",
      tags: [
        ["u", url.toString()],
        ["method", "POST"],
        ["payload", bytesToHex(sha256(new TextEncoder().encode(body)))],
        ["nonce", randomNonce()],
      ],
    });
    const response = await this.#fetch(url, {
      method: "POST",
      headers: {
        Authorization: encodeNostrHttpAuthorization(auth),
        "Content-Type": "application/json",
      },
      body,
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) throw await responseError(response);
    return response;
  }

  async #forgeJsonRequest<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    value?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    if (method === "GET")
      return await this.#strictGet(
        path,
        signal === undefined ? {} : { signal },
      );
    this.#assertOpen(signal);
    const body = value === undefined ? undefined : JSON.stringify(value);
    const url = new URL(path, this.#httpBaseUrl());
    const tags = [
      ["u", url.toString()],
      ["method", method],
      ["nonce", randomNonce()],
    ];
    if (body !== undefined) {
      tags.push([
        "payload",
        bytesToHex(sha256(new TextEncoder().encode(body))),
      ]);
    }
    const auth = await this.#requiredIdentity().signEvent({
      kind: PROJECT_FORGE_KINDS.httpAuth,
      created_at: Math.floor(this.#now().getTime() / 1_000),
      content: "",
      tags,
    });
    const response = await this.#fetch(url, {
      method,
      headers: {
        Authorization: encodeNostrHttpAuthorization(auth),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body }),
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) throw await responseError(response);
    const result = (await response.json()) as T;
    this.#readCache.clear();
    return result;
  }

  #httpBaseUrl(): URL {
    if (this.#context.httpBaseUrl) return new URL(this.#context.httpBaseUrl);
    const url = new URL(this.relayUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  }

  #requiredIdentity(): RegistrySigner {
    if (!this.#context.identity)
      throw new Error("This project action requires a Nostr identity");
    return this.#context.identity;
  }

  #assertOpen(signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (this.#closed) throw new Error("Project forge session is closed");
  }
}

function abortableDelay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    function onAbort() {
      clearTimeout(timeout);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export * from "./repository-activity.js";

export function parseSseResult<T>(
  body: string,
  onProgress?: (progress: ProjectForgeProgress) => void,
): T {
  let result: T | undefined;
  for (const block of body.split(/\r?\n\r?\n/u)) {
    const lines = block.split(/\r?\n/u);
    const type = lines
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim();
    const dataText = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!type || !dataText) continue;
    const data = JSON.parse(dataText) as unknown;
    if (type === "result") result = data as T;
    else if (type === "error") {
      throw new Error(errorMessage(data, "Hosted Git request failed"));
    } else if (type === "notice" || type === "progress" || type === "task") {
      onProgress?.({
        type,
        message: errorMessage(data, type),
        data,
      });
    }
  }
  if (result === undefined)
    throw new Error("Hosted Git stream ended without a result");
  return result;
}

function cloneTemplate(template: NostrEventTemplate): NostrEventTemplate {
  return { ...template, tags: template.tags.map((tag) => [...tag]) };
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function distinctEvents(events: readonly NostrEvent[]): NostrEvent[] {
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

function encodePath(path: string): string {
  return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function repositoryAddress(coordinate: string): {
  owner: string;
  identifier: string;
} {
  const address = coordinate.split(":");
  if (
    address.length < 3 ||
    address[0] !== String(PROJECT_FORGE_KINDS.repository) ||
    !/^[0-9a-f]{64}$/u.test(address[1] ?? "")
  ) {
    throw new Error(
      "Repository reads require a kind 30617 repository coordinate",
    );
  }
  return { owner: address[1]!, identifier: address.slice(2).join(":") };
}

function randomNonce(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function responseError(response: Response): Promise<Error> {
  const text = await response.text();
  let message = text || `${response.status} ${response.statusText}`;
  try {
    message = errorMessage(JSON.parse(text) as unknown, message);
  } catch {
    // Preserve a non-JSON relay response.
  }
  return new Error(message);
}

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    for (const key of ["message", "error", "detail"] as const) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === "string" && candidate) return candidate;
    }
  }
  return fallback;
}
