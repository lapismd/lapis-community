import type {
  CommunityEventBatch,
  CommunityCachedHistoryPage,
  CommunityCachedEventQuery,
  CommunityCachedEventPage,
  CommunityEventRuntime,
  CommunityRuntimeRevision,
  CommunityRuntimeSearch,
  CommunityRuntimeSelection,
  CommunityScope,
  CommunitySearchResult,
} from "./contracts.js";
import { createBrowserCommunityEventStore } from "./browser-event-store.js";
import { createInlineCommunityEventRuntime } from "./event-runtime.js";
import { canUseTursoCommunityEventStore } from "./turso-event-store.js";
import type {
  CommunityAgentActivityStore,
  CommunityAgentArchiveRequest,
} from "./agent-contracts.js";
import { dispatchAgentArchive } from "./agent-archive.js";
import { copyCommunityWorkerPayload } from "./community-worker-payload.js";

interface WorkerLike {
  postMessage(value: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  value?: unknown;
  error?: string;
}

export interface BrowserCommunityEventRuntimeOptions {
  workerFactory?: () => WorkerLike;
  onDegraded?: (reason: string) => void;
}

export function createBrowserCommunityEventRuntime(
  options: BrowserCommunityEventRuntimeOptions = {},
): CommunityEventRuntime {
  // Turso's browser driver owns a WASM worker pool. Opening it from this
  // runtime's application worker can leave the driver's pthread registry
  // incomplete. Keep the database in the
  // browser owner context, matching the Lapis app database integration.
  if (canUseTursoCommunityEventStore()) {
    return createInlineBrowserCommunityEventRuntime(options);
  }
  if (typeof Worker === "undefined" && options.workerFactory === undefined) {
    options.onDegraded?.("Web Workers are unavailable; using inline runtime");
    return createInlineBrowserCommunityEventRuntime(options);
  }
  return new BrowserCommunityEventRuntime(options);
}

function createInlineBrowserCommunityEventRuntime(
  options: BrowserCommunityEventRuntimeOptions,
): CommunityEventRuntime {
  return createInlineCommunityEventRuntime({
    store: createBrowserCommunityEventStore({
      ...(options.onDegraded === undefined
        ? {}
        : { onDegraded: options.onDegraded }),
    }),
  });
}

class BrowserCommunityEventRuntime implements CommunityEventRuntime {
  readonly agentActivity: CommunityAgentActivityStore = {
    append: (scope, records) =>
      this.#archive({ operation: "append", scope, records }),
    page: (query) => this.#archive({ operation: "page", query }),
    agents: (scope) => this.#archive({ operation: "agents", scope }),
    clear: (scope, agentPubkey) =>
      this.#archive({
        operation: "clear",
        scope,
        ...(agentPubkey ? { agentPubkey } : {}),
      }),
    checkpoint: (scope, agentPubkey, context) =>
      this.#archive({
        operation: "checkpoint",
        scope,
        agentPubkey,
        context,
      }),
    commitSyncPage: (scope, agentPubkey, context, records, checkpoint) =>
      this.#archive({
        operation: "commitSyncPage",
        scope,
        agentPubkey,
        context,
        records,
        checkpoint,
      }),
    suppressBefore: (scope, agentPubkey, timestamp) =>
      this.#archive({
        operation: "suppressBefore",
        scope,
        agentPubkey,
        timestamp,
      }),
  };

  async #archive<T>(request: CommunityAgentArchiveRequest): Promise<T> {
    await this.#restoreAfterCrash();
    if (this.#fallback)
      return (await dispatchAgentArchive(
        this.#fallback.agentActivity,
        request,
      )) as T;
    return this.#request({ method: "archive", request });
  }
  readonly #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (cause: unknown) => void }
  >();
  #worker: WorkerLike | undefined;
  #fallback: CommunityEventRuntime | undefined;
  #nextRequestId = 1;
  #failures = 0;
  #scopes: readonly CommunityScope[] = [];
  #generation = 0;
  #restoreOptions: { metadataOnly?: boolean } = {};
  #restoring: Promise<void> | undefined;

  constructor(private readonly options: BrowserCommunityEventRuntimeOptions) {}

  async restore(
    scopes: readonly CommunityScope[],
    generation = 0,
    options: { metadataOnly?: boolean } = {},
  ): Promise<CommunityRuntimeRevision> {
    this.#scopes = scopes;
    this.#restoreOptions = options;
    this.#generation = generation;
    if (this.#fallback !== undefined) {
      return this.#fallback.restore(scopes, generation, options);
    }
    return this.#request<CommunityRuntimeRevision>({
      method: "restore",
      scopes,
      generation,
      options,
    });
  }

  async ingest(
    batch: CommunityEventBatch,
  ): Promise<CommunityRuntimeRevision | undefined> {
    if (this.#fallback !== undefined) return this.#fallback.ingest(batch);
    await this.#restoreAfterCrash();
    return this.#request({ method: "ingest", batch });
  }

  async readCachedEvents(
    scope: CommunityScope,
    query: CommunityCachedEventQuery,
  ): Promise<CommunityCachedEventPage> {
    await this.#restoreAfterCrash();
    if (this.#fallback)
      return (
        this.#fallback.readCachedEvents?.(scope, query) ?? {
          events: [],
          hasMoreCached: false,
        }
      );
    return this.#request({ method: "readCachedEvents", scope, query });
  }

  async readHistoryPage(
    scope: CommunityScope,
    key: string,
  ): Promise<CommunityCachedHistoryPage | undefined> {
    await this.#restoreAfterCrash();
    if (this.#fallback) return this.#fallback.readHistoryPage?.(scope, key);
    return this.#request({ method: "readHistoryPage", scope, key });
  }

  async project(
    selection: CommunityRuntimeSelection,
  ): Promise<CommunityRuntimeRevision> {
    if (this.#fallback !== undefined) return this.#fallback.project(selection);
    await this.#restoreAfterCrash();
    return this.#request({ method: "project", selection });
  }

  async search(
    query: CommunityRuntimeSearch,
  ): Promise<readonly CommunitySearchResult[]> {
    if (this.#fallback !== undefined) return this.#fallback.search(query);
    await this.#restoreAfterCrash();
    return this.#request({ method: "search", query });
  }

  async clearPrivate(): Promise<void> {
    if (this.#fallback) return this.#fallback.clearPrivate?.();
    await this.#restoreAfterCrash();
    await this.#request({ method: "clearPrivate" });
  }

  async clear(scope?: CommunityScope): Promise<void> {
    if (this.#fallback !== undefined) return this.#fallback.clear(scope);
    await this.#restoreAfterCrash();
    await this.#request({
      method: "clear",
      ...(scope === undefined ? {} : { scope }),
    });
  }

  dispose(): void {
    this.#fallback?.dispose();
    if (this.#worker !== undefined) {
      this.#worker.postMessage({
        id: this.#nextRequestId++,
        method: "dispose",
      });
      this.#worker.terminate();
    }
    this.#worker = undefined;
    this.#rejectPending(new Error("Community event runtime disposed"));
  }

  async #request<T>(request: Record<string, unknown>): Promise<T> {
    const worker = this.#ensureWorker();
    const id = this.#nextRequestId++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      worker.postMessage(copyCommunityWorkerPayload({ id, ...request }));
    });
  }

  #ensureWorker(): WorkerLike {
    if (this.#worker !== undefined) return this.#worker;
    const worker =
      this.options.workerFactory?.() ??
      new Worker(new URL("./community-event-worker.js", import.meta.url), {
        type: "module",
        name: "lapis-community-events",
      });
    worker.onmessage = (message: MessageEvent<WorkerResponse>) => {
      const pending = this.#pending.get(message.data.id);
      if (pending === undefined) return;
      this.#pending.delete(message.data.id);
      if (message.data.ok) pending.resolve(message.data.value);
      else
        pending.reject(
          new Error(message.data.error ?? "Worker request failed"),
        );
    };
    worker.onerror = (event) => {
      this.#failures += 1;
      this.#worker?.terminate();
      this.#worker = undefined;
      this.#rejectPending(
        new Error(event.message || "Community worker failed"),
      );
      if (this.#failures > 1) this.#activateFallback();
    };
    this.#worker = worker;
    return worker;
  }

  async #restoreAfterCrash(): Promise<void> {
    if (this.#worker !== undefined || this.#scopes.length === 0) return;
    if (this.#failures > 1) {
      await this.#activateFallback();
      return;
    }
    if (this.#restoring !== undefined) return this.#restoring;
    this.#restoring = this.#request({
      method: "restore",
      scopes: this.#scopes,
      generation: this.#generation,
      options: this.#restoreOptions,
    }).then(() => undefined);
    try {
      await this.#restoring;
    } finally {
      this.#restoring = undefined;
    }
  }

  async #activateFallback(): Promise<void> {
    if (this.#fallback !== undefined) return;
    this.options.onDegraded?.(
      "Community worker failed repeatedly; using the inline runtime",
    );
    const fallback = createInlineBrowserCommunityEventRuntime(this.options);
    this.#fallback = fallback;
    if (this.#scopes.length > 0) {
      await fallback.restore(
        this.#scopes,
        this.#generation,
        this.#restoreOptions,
      );
    }
  }

  #rejectPending(cause: Error): void {
    for (const pending of this.#pending.values()) pending.reject(cause);
    this.#pending.clear();
  }
}
