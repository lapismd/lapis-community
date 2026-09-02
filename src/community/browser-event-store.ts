import type {
  CommunityCacheAudience,
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
    throw new Error(failures.join("; ") || "No community event store available");
  }

  restore(
    scope: CommunityScope,
    audience?: CommunityCacheAudience,
  ): Promise<CommunityCachedScope> {
    return this.#requireStore().restore(scope, audience);
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
        ? [createTursoCommunityEventStore(options)]
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
