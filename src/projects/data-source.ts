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
  type ProjectForgeCatalog,
  type ProjectForgeCommitResponse,
  type ProjectForgeCommitsResponse,
  type ProjectForgeProgress,
  type ProjectForgePullRequestDiff,
  type ProjectForgeRefsResponse,
  type ProjectForgeTreeResponse,
  type ProjectForgeWorkItems,
} from "./model.js";
import {
  materializeProjectForgeCatalog,
  materializeProjectForgeWorkItems,
} from "./reducer.js";

const PROJECT_PAGE_SIZE = 500;
const WORK_ITEM_LIMIT = 2_000;
const TOMBSTONE_CHUNK_SIZE = 100;

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
  return {
    async open(context, signal) {
      signal?.throwIfAborted();
      const relay = options.relayFactory.create(context.relayUrl);
      const request = options.fetch ?? globalThis.fetch.bind(globalThis);
      const now = options.now ?? (() => new Date());
      if (context.identity) {
        await authenticateRegistryRelay(relay, context.identity, signal);
      }
      return new Nip34ProjectForgeSession(relay, context, request, now);
    },
  };
}

class Nip34ProjectForgeSession implements ProjectForgeSession {
  readonly relayUrl: string;
  readonly #relay: CommunityRelay;
  readonly #context: ProjectForgeDataSourceContext;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #subscriptions = new Set<CommunityRelaySubscription>();
  #closed = false;

  constructor(
    relay: CommunityRelay,
    context: ProjectForgeDataSourceContext,
    request: typeof globalThis.fetch,
    now: () => Date,
  ) {
    this.relayUrl = relay.url;
    this.#relay = relay;
    this.#context = context;
    this.#fetch = request;
    this.#now = now;
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
      [...rootIds, ...bundles.flat().map((event) => event.id)],
      signal,
    );
    return materializeProjectForgeWorkItems(repository, [
      ...bundles.flat(),
      ...nip22,
      ...tombstones,
    ]);
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
    return await this.#forgeGet(repository, "refs", signal);
  }

  async loadTree(
    repository: string,
    revision: string,
    path = "",
    signal?: AbortSignal,
  ): Promise<ProjectForgeTreeResponse> {
    return await this.#forgeGet(
      repository,
      `tree/${encodeURIComponent(revision)}/${encodePath(path)}`,
      signal,
    );
  }

  async loadBlob(
    repository: string,
    revision: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeBlobResponse> {
    return await this.#forgeGet(
      repository,
      `blob/${encodeURIComponent(revision)}/${encodePath(path)}`,
      signal,
    );
  }

  async loadCommits(
    repository: string,
    ref?: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeCommitsResponse> {
    const suffix = ref ? `commits?ref=${encodeURIComponent(ref)}` : "commits";
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
    const address = coordinate.split(":");
    if (
      address.length < 3 ||
      address[0] !== String(PROJECT_FORGE_KINDS.repository) ||
      !/^[0-9a-f]{64}$/u.test(address[1] ?? "")
    ) {
      throw new Error(
        "Hosted Git reads require a kind 30617 repository coordinate",
      );
    }
    const identifier = address.slice(2).join(":");
    return await this.#strictGet(
      `/api/git/${address[1]}/${encodeURIComponent(identifier)}/${suffix}`,
      signal === undefined ? {} : { signal },
    );
  }

  async #strictGet<T>(
    path: string,
    options: {
      signal?: AbortSignal;
      onProgress?: (progress: ProjectForgeProgress) => void;
    },
  ): Promise<T> {
    this.#assertOpen(options.signal);
    const identity = this.#requiredIdentity();
    const url = new URL(path, this.#httpBaseUrl());
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
    return (await response.json()) as T;
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

export function buzzWorkItemFilters(
  repositoryCoordinate: string,
): RelayFilter[] {
  return [
    {
      kinds: [PROJECT_FORGE_KINDS.task, PROJECT_FORGE_KINDS.pullRequest],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
    {
      kinds: [PROJECT_FORGE_KINDS.pullRequestUpdate],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
    {
      kinds: [PROJECT_FORGE_KINDS.note],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
    {
      kinds: [
        PROJECT_FORGE_KINDS.statusOpen,
        PROJECT_FORGE_KINDS.statusMerged,
        PROJECT_FORGE_KINDS.statusClosed,
        PROJECT_FORGE_KINDS.statusDraft,
      ],
      "#a": [repositoryCoordinate],
      limit: WORK_ITEM_LIMIT,
    },
  ];
}

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
