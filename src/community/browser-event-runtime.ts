import type {
  CommunityEventBatch,
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
  // runtime's application worker would create a nested worker graph and can
  // leave the driver's pthread registry incomplete. Keep the database in the
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
  readonly #options: BrowserCommunityEventRuntimeOptions;
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
  #restoring: Promise<void> | undefined;

  constructor(options: BrowserCommunityEventRuntimeOptions) {
    this.#options = options;
  }

  async restore(
    scopes: readonly CommunityScope[],
    generation = 0,
  ): Promise<CommunityRuntimeRevision> {
    this.#scopes = scopes;
    this.#generation = generation;
    if (this.#fallback !== undefined) {
      return this.#fallback.restore(scopes, generation);
    }
    return this.#request<CommunityRuntimeRevision>({
      method: "restore",
      scopes,
      generation,
    });
  }

  async ingest(
    batch: CommunityEventBatch,
  ): Promise<CommunityRuntimeRevision | undefined> {
    if (this.#fallback !== undefined) return this.#fallback.ingest(batch);
    await this.#restoreAfterCrash();
    return this.#request({ method: "ingest", batch });
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
      worker.postMessage({ id, ...request });
    });
  }

  #ensureWorker(): WorkerLike {
    if (this.#worker !== undefined) return this.#worker;
    const worker =
      this.#options.workerFactory?.() ??
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
    }).then(() => undefined);
    try {
      await this.#restoring;
    } finally {
      this.#restoring = undefined;
    }
  }

  async #activateFallback(): Promise<void> {
    if (this.#fallback !== undefined) return;
    this.#options.onDegraded?.(
      "Community worker failed repeatedly; using the inline runtime",
    );
    const fallback = createInlineBrowserCommunityEventRuntime(this.#options);
    this.#fallback = fallback;
    if (this.#scopes.length > 0) {
      await fallback.restore(this.#scopes, this.#generation);
    }
  }

  #rejectPending(cause: Error): void {
    for (const pending of this.#pending.values()) pending.reject(cause);
    this.#pending.clear();
  }
}
