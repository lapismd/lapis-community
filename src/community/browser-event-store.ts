import type {
  CommunityCacheAudience,
  CommunityCachedHistoryPage,
  CommunityCachedEventQuery,
  CommunityCachedScope,
  CommunityEventStore,
  CommunityScope,
  CommunityStorageMode,
  CommunitySyncCheckpoint,
  CommunitySyncPlan,
  CommunityVerifiedEventBatch,
} from "./contracts.js";
import {
  createMemoryCommunityEventStore,
  type CommunityEventStoreOptions,
} from "./event-store.js";
import { createIndexedDbCommunityEventStore } from "./indexeddb-event-store.js";
import {
  canUseTursoCommunityEventStore,
  createTursoCommunityEventStore,
} from "./turso-event-store.js";
import { agentActivityProxy } from "./agent-archive.js";

const DEFAULT_TURSO_DATABASE_NAME = "lapismd-community-event-cache-v1.db";
const SHARED_TURSO_STORES = Symbol.for(
  "@lapismd/lapis-community/browser-turso-stores/v1",
);

interface SharedTursoStoreEntry {
  readonly store: CommunityEventStore;
  readonly open: Promise<void>;
  readonly maxBytes: number | undefined;
  references: number;
}

type SharedTursoStoreRegistry = Map<string, SharedTursoStoreEntry>;

export interface BrowserCommunityEventStoreOptions
  extends CommunityEventStoreOptions {
  databaseName?: string;
  onDegraded?: (reason: string) => void;
}

/**
 * Selects the strongest available browser store without changing the controller
 * or source contract. A failed backend is disposable and the next backend is
 * opened instead.
 */
export function createBrowserCommunityEventStore(
  options: BrowserCommunityEventStoreOptions = {},
): CommunityEventStore & { readonly degradedReason: string | undefined } {
  return new BrowserCommunityEventStore(options);
}

class BrowserCommunityEventStore implements CommunityEventStore {
  readonly agentActivity = agentActivityProxy(async () => {
    await this.open();
    const archive = this.#requireStore().agentActivity;
    if (!archive)
      throw new Error("Agent history is unavailable in this storage backend");
    return archive;
  });
  readonly #options: BrowserCommunityEventStoreOptions;
  #store: CommunityEventStore | undefined;
  #degradedReason: string | undefined;

  constructor(options: BrowserCommunityEventStoreOptions) {
    this.#options = options;
  }

  get mode(): CommunityStorageMode {
    return this.#store?.mode ?? "memory";
  }

  get degradedReason(): string | undefined {
    return this.#degradedReason;
  }

  async open(): Promise<void> {
    if (this.#store !== undefined) return;
    const failures: string[] = [];
    const candidates = this.#candidates();
    for (const candidate of candidates) {
      try {
        await candidate.open();
        this.#store = candidate;
        if (failures.length > 0) {
          this.#degradedReason = failures.join("; ");
          this.#options.onDegraded?.(this.#degradedReason);
        }
        return;
      } catch (cause) {
        await candidate.close().catch(() => undefined);
        failures.push(
          `${candidate.mode}: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }
    }
    throw new Error(
      failures.join("; ") || "No community event store available",
    );
  }

  restore(
    scope: CommunityScope,
    audience?: CommunityCacheAudience,
  ): Promise<CommunityCachedScope> {
    return this.#requireStore().restore(scope, audience);
  }

  restoreMetadata(scope: CommunityScope) {
    const store = this.#requireStore();
    return store.restoreMetadata?.(scope) ?? store.restore(scope);
  }
  async readCachedEvents(
    scope: CommunityScope,
    query: CommunityCachedEventQuery,
  ) {
    return (
      this.#requireStore().readCachedEvents?.(scope, query) ?? {
        events: [],
        hasMoreCached: false,
      }
    );
  }

  readHistoryPage(
    scope: CommunityScope,
    key: string,
  ): Promise<CommunityCachedHistoryPage | undefined> {
    return (
      this.#requireStore().readHistoryPage?.(scope, key) ??
      Promise.resolve(undefined)
    );
  }

  commit(batch: CommunityVerifiedEventBatch): Promise<void> {
    return this.#requireStore().commit(batch);
  }

  syncPlan(scope: CommunityScope): Promise<CommunitySyncPlan> {
    return this.#requireStore().syncPlan(scope);
  }

  markSynchronized(
    scope: CommunityScope,
    checkpoints: readonly CommunitySyncCheckpoint[],
  ): Promise<void> {
    return this.#requireStore().markSynchronized(scope, checkpoints);
  }

  prune(): Promise<void> {
    return this.#requireStore().prune();
  }

  clear(scope?: CommunityScope): Promise<void> {
    return this.#requireStore().clear(scope);
  }

  async close(): Promise<void> {
    await this.#store?.close();
    this.#store = undefined;
  }

  #candidates(): CommunityEventStore[] {
    const options = {
      ...(this.#options.databaseName === undefined
        ? {}
        : { databaseName: this.#options.databaseName }),
      ...(this.#options.maxBytes === undefined
        ? {}
        : { maxBytes: this.#options.maxBytes }),
    };
    return [
      ...(canUseTursoCommunityEventStore()
        ? [createSharedTursoCommunityEventStore(options)]
        : []),
      ...(typeof indexedDB === "undefined"
        ? []
        : [createIndexedDbCommunityEventStore(options)]),
      createMemoryCommunityEventStore(
        this.#options.maxBytes === undefined
          ? {}
          : { maxBytes: this.#options.maxBytes },
      ),
    ];
  }

  #requireStore(): CommunityEventStore {
    if (this.#store === undefined) {
      throw new Error("Community event store is not open");
    }
    return this.#store;
  }
}

function createSharedTursoCommunityEventStore(
  options: Pick<BrowserCommunityEventStoreOptions, "databaseName" | "maxBytes">,
): CommunityEventStore {
  return new SharedTursoCommunityEventStore(options);
}

/**
 * Shares one Turso connection between Community runtimes in this browser
 * owner context. This covers multiple views and hot-reloaded package copies
 * without exposing a second OPFS opener to the driver's worker pool.
 */
class SharedTursoCommunityEventStore implements CommunityEventStore {
  readonly agentActivity = agentActivityProxy(async () => {
    await this.open();
    const archive = this.#store().agentActivity;
    if (!archive)
      throw new Error("Agent history is unavailable in this storage backend");
    return archive;
  });
  readonly mode = "turso-opfs" as const;
  readonly #databaseName: string;
  readonly #maxBytes: number | undefined;
  #entry: SharedTursoStoreEntry | undefined;

  constructor(
    options: Pick<
      BrowserCommunityEventStoreOptions,
      "databaseName" | "maxBytes"
    >,
  ) {
    this.#databaseName = options.databaseName ?? DEFAULT_TURSO_DATABASE_NAME;
    this.#maxBytes = options.maxBytes;
  }

  async open(): Promise<void> {
    if (this.#entry !== undefined) return;
    const registry = sharedTursoStoreRegistry();
    let entry = registry.get(this.#databaseName);
    if (entry !== undefined && entry.maxBytes !== this.#maxBytes) {
      throw new Error(
        `Community cache ${this.#databaseName} is already open with different retention options`,
      );
    }
    if (entry === undefined) {
      const store = createTursoCommunityEventStore({
        databaseName: this.#databaseName,
        ...(this.#maxBytes === undefined ? {} : { maxBytes: this.#maxBytes }),
      });
      entry = {
        store,
        open: Promise.resolve(),
        maxBytes: this.#maxBytes,
        references: 0,
      };
      entry = {
        ...entry,
        open: store.open().catch((cause: unknown) => {
          if (registry.get(this.#databaseName) === entry) {
            registry.delete(this.#databaseName);
          }
          throw cause;
        }),
      };
      registry.set(this.#databaseName, entry);
    }

    entry.references += 1;
    this.#entry = entry;
    await entry.open;
  }

  restore(
    scope: CommunityScope,
    audience?: CommunityCacheAudience,
  ): Promise<CommunityCachedScope> {
    return this.#store().restore(scope, audience);
  }

  restoreMetadata(scope: CommunityScope) {
    const store = this.#store();
    return store.restoreMetadata?.(scope) ?? store.restore(scope);
  }
  async readCachedEvents(
    scope: CommunityScope,
    query: CommunityCachedEventQuery,
  ) {
    return (
      this.#store().readCachedEvents?.(scope, query) ?? {
        events: [],
        hasMoreCached: false,
      }
    );
  }

  readHistoryPage(
    scope: CommunityScope,
    key: string,
  ): Promise<CommunityCachedHistoryPage | undefined> {
    return (
      this.#store().readHistoryPage?.(scope, key) ?? Promise.resolve(undefined)
    );
  }

  commit(batch: CommunityVerifiedEventBatch): Promise<void> {
    return this.#store().commit(batch);
  }

  syncPlan(scope: CommunityScope): Promise<CommunitySyncPlan> {
    return this.#store().syncPlan(scope);
  }

  markSynchronized(
    scope: CommunityScope,
    checkpoints: readonly CommunitySyncCheckpoint[],
  ): Promise<void> {
    return this.#store().markSynchronized(scope, checkpoints);
  }

  prune(): Promise<void> {
    return this.#store().prune();
  }

  clear(scope?: CommunityScope): Promise<void> {
    return this.#store().clear(scope);
  }

  async close(): Promise<void> {
    const entry = this.#entry;
    if (entry === undefined) return;
    this.#entry = undefined;
    entry.references -= 1;
    if (entry.references > 0) return;

    const registry = sharedTursoStoreRegistry();
    if (registry.get(this.#databaseName) === entry) {
      registry.delete(this.#databaseName);
    }
    await entry.open.catch(() => undefined);
    await entry.store.close();
  }

  #store(): CommunityEventStore {
    if (this.#entry === undefined) {
      throw new Error("Shared Community Turso store is not open");
    }
    return this.#entry.store;
  }
}

function sharedTursoStoreRegistry(): SharedTursoStoreRegistry {
  const owner = globalThis as unknown as Record<symbol, unknown>;
  const existing = owner[SHARED_TURSO_STORES];
  if (existing instanceof Map) {
    return existing as SharedTursoStoreRegistry;
  }
  const registry: SharedTursoStoreRegistry = new Map();
  owner[SHARED_TURSO_STORES] = registry;
  return registry;
}
