import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import type { NostrEvent } from "../protocol/index.js";

export interface RegistryManifestSnapshot {
  attachmentSha256: string;
  bytes: Uint8Array;
}

export interface RegistryEventSnapshot {
  schemaVersion: 1;
  key: string;
  synchronizedAt: string;
  events: readonly NostrEvent[];
  manifests: readonly RegistryManifestSnapshot[];
}

export interface RegistryResourceSnapshot {
  sha256: string;
  mediaType: string;
  bytes: Uint8Array;
  lastAccessedAt: number;
}

export interface RegistrySnapshotStore {
  readonly mode: "memory" | "indexeddb";
  open(): Promise<void>;
  loadSnapshot(key: string): Promise<RegistryEventSnapshot | undefined>;
  saveSnapshot(snapshot: RegistryEventSnapshot): Promise<void>;
  loadResource(sha256: string): Promise<RegistryResourceSnapshot | undefined>;
  saveResource(resource: RegistryResourceSnapshot): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

export interface RegistrySnapshotStoreOptions {
  maxResourceBytes?: number;
  maxSnapshots?: number;
}

export interface IndexedDbRegistrySnapshotStoreOptions
  extends RegistrySnapshotStoreOptions {
  databaseName?: string;
}

const DEFAULT_MAX_RESOURCE_BYTES = 64 * 1_024 * 1_024;
const DEFAULT_MAX_SNAPSHOTS = 8;

export function createMemoryRegistrySnapshotStore(
  options: RegistrySnapshotStoreOptions = {},
): RegistrySnapshotStore {
  return new MemoryRegistrySnapshotStore(
    options.maxResourceBytes ?? DEFAULT_MAX_RESOURCE_BYTES,
    options.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS,
  );
}

export function createIndexedDbRegistrySnapshotStore(
  options: IndexedDbRegistrySnapshotStoreOptions = {},
): RegistrySnapshotStore {
  return new IndexedDbRegistrySnapshotStore(options);
}

export function createBrowserRegistrySnapshotStore(
  options: IndexedDbRegistrySnapshotStoreOptions = {},
): RegistrySnapshotStore {
  return new BrowserRegistrySnapshotStore(options);
}

class MemoryRegistrySnapshotStore implements RegistrySnapshotStore {
  readonly mode = "memory" as const;
  readonly #maxResourceBytes: number;
  readonly #maxSnapshots: number;
  readonly #snapshots = new Map<string, RegistryEventSnapshot>();
  readonly #resources = new Map<string, RegistryResourceSnapshot>();
  #opened = false;

  constructor(maxResourceBytes: number, maxSnapshots: number) {
    this.#maxResourceBytes = maxResourceBytes;
    this.#maxSnapshots = Math.max(1, maxSnapshots);
  }

  async open(): Promise<void> {
    this.#opened = true;
  }

  async loadSnapshot(key: string): Promise<RegistryEventSnapshot | undefined> {
    this.#assertOpen();
    const snapshot = this.#snapshots.get(key);
    return snapshot === undefined ? undefined : cloneSnapshot(snapshot);
  }

  async saveSnapshot(snapshot: RegistryEventSnapshot): Promise<void> {
    this.#assertOpen();
    this.#snapshots.set(snapshot.key, cloneSnapshot(snapshot));
    for (const stale of [...this.#snapshots.values()]
      .toSorted((left, right) =>
        right.synchronizedAt.localeCompare(left.synchronizedAt),
      )
      .slice(this.#maxSnapshots)) {
      this.#snapshots.delete(stale.key);
    }
  }

  async loadResource(
    sha256: string,
  ): Promise<RegistryResourceSnapshot | undefined> {
    this.#assertOpen();
    const resource = this.#resources.get(sha256);
    if (resource === undefined) return undefined;
    const accessed = { ...cloneResource(resource), lastAccessedAt: Date.now() };
    this.#resources.set(sha256, accessed);
    return cloneResource(accessed);
  }

  async saveResource(resource: RegistryResourceSnapshot): Promise<void> {
    this.#assertOpen();
    this.#resources.set(resource.sha256, cloneResource(resource));
    this.#prune();
  }

  async clear(): Promise<void> {
    this.#assertOpen();
    this.#snapshots.clear();
    this.#resources.clear();
  }

  async close(): Promise<void> {
    this.#opened = false;
  }

  #prune(): void {
    let total = [...this.#resources.values()].reduce(
      (sum, resource) => sum + resource.bytes.byteLength,
      0,
    );
    for (const resource of [...this.#resources.values()].toSorted(
      (left, right) => left.lastAccessedAt - right.lastAccessedAt,
    )) {
      if (total <= this.#maxResourceBytes) break;
      this.#resources.delete(resource.sha256);
      total -= resource.bytes.byteLength;
    }
  }

  #assertOpen(): void {
    if (!this.#opened) throw new Error("Registry snapshot store is not open");
  }
}

interface RegistryCacheDb extends DBSchema {
  snapshots: {
    key: string;
    value: RegistryEventSnapshot;
  };
  resources: {
    key: string;
    value: RegistryResourceSnapshot;
    indexes: { access: number };
  };
}

class IndexedDbRegistrySnapshotStore implements RegistrySnapshotStore {
  readonly mode = "indexeddb" as const;
  readonly #databaseName: string;
  readonly #maxResourceBytes: number;
  readonly #maxSnapshots: number;
  #database: IDBPDatabase<RegistryCacheDb> | undefined;

  constructor(options: IndexedDbRegistrySnapshotStoreOptions) {
    this.#databaseName = options.databaseName ?? "lapismd-registry-cache-v1";
    this.#maxResourceBytes =
      options.maxResourceBytes ?? DEFAULT_MAX_RESOURCE_BYTES;
    this.#maxSnapshots = Math.max(
      1,
      options.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS,
    );
  }

  async open(): Promise<void> {
    if (this.#database !== undefined) return;
    this.#database = await openDB<RegistryCacheDb>(this.#databaseName, 1, {
      upgrade(database) {
        database.createObjectStore("snapshots", { keyPath: "key" });
        const resources = database.createObjectStore("resources", {
          keyPath: "sha256",
        });
        resources.createIndex("access", "lastAccessedAt");
      },
    });
  }

  async loadSnapshot(key: string): Promise<RegistryEventSnapshot | undefined> {
    return await this.#requireDatabase().get("snapshots", key);
  }

  async saveSnapshot(snapshot: RegistryEventSnapshot): Promise<void> {
    const database = this.#requireDatabase();
    await database.put("snapshots", snapshot);
    const snapshots = (await database.getAll("snapshots")).toSorted(
      (left, right) => right.synchronizedAt.localeCompare(left.synchronizedAt),
    );
    const stale = snapshots.slice(this.#maxSnapshots);
    if (stale.length === 0) return;
    const transaction = database.transaction("snapshots", "readwrite");
    await Promise.all(
      stale.map((entry) => transaction.store.delete(entry.key)),
    );
    await transaction.done;
  }

  async loadResource(
    sha256: string,
  ): Promise<RegistryResourceSnapshot | undefined> {
    const database = this.#requireDatabase();
    const resource = await database.get("resources", sha256);
    if (resource === undefined) return undefined;
    const accessed = { ...resource, lastAccessedAt: Date.now() };
    await database.put("resources", accessed);
    return accessed;
  }

  async saveResource(resource: RegistryResourceSnapshot): Promise<void> {
    const database = this.#requireDatabase();
    await database.put("resources", resource);
    await this.#prune();
  }

  async clear(): Promise<void> {
    const transaction = this.#requireDatabase().transaction(
      ["snapshots", "resources"],
      "readwrite",
    );
    await Promise.all([
      transaction.objectStore("snapshots").clear(),
      transaction.objectStore("resources").clear(),
    ]);
    await transaction.done;
  }

  async close(): Promise<void> {
    this.#database?.close();
    this.#database = undefined;
  }

  async #prune(): Promise<void> {
    const database = this.#requireDatabase();
    const resources = await database.getAllFromIndex("resources", "access");
    let total = resources.reduce(
      (sum, resource) => sum + resource.bytes.byteLength,
      0,
    );
    if (total <= this.#maxResourceBytes) return;
    const transaction = database.transaction("resources", "readwrite");
    for (const resource of resources) {
      await transaction.store.delete(resource.sha256);
      total -= resource.bytes.byteLength;
      if (total <= this.#maxResourceBytes) break;
    }
    await transaction.done;
  }

  #requireDatabase(): IDBPDatabase<RegistryCacheDb> {
    if (this.#database === undefined) {
      throw new Error("Registry snapshot store is not open");
    }
    return this.#database;
  }
}

class BrowserRegistrySnapshotStore implements RegistrySnapshotStore {
  readonly #options: IndexedDbRegistrySnapshotStoreOptions;
  #store: RegistrySnapshotStore | undefined;

  constructor(options: IndexedDbRegistrySnapshotStoreOptions) {
    this.#options = options;
  }

  get mode(): "memory" | "indexeddb" {
    return this.#store?.mode ?? "memory";
  }

  async open(): Promise<void> {
    if (this.#store !== undefined) return;
    const candidates = [
      ...(typeof indexedDB === "undefined"
        ? []
        : [createIndexedDbRegistrySnapshotStore(this.#options)]),
      createMemoryRegistrySnapshotStore(this.#options),
    ];
    let finalError: unknown;
    for (const candidate of candidates) {
      try {
        await candidate.open();
        this.#store = candidate;
        return;
      } catch (cause) {
        finalError = cause;
        await candidate.close().catch(() => undefined);
      }
    }
    throw finalError ?? new Error("No registry snapshot store is available");
  }

  loadSnapshot(key: string): Promise<RegistryEventSnapshot | undefined> {
    return this.#requireStore().loadSnapshot(key);
  }

  saveSnapshot(snapshot: RegistryEventSnapshot): Promise<void> {
    return this.#requireStore().saveSnapshot(snapshot);
  }

  loadResource(sha256: string): Promise<RegistryResourceSnapshot | undefined> {
    return this.#requireStore().loadResource(sha256);
  }

  saveResource(resource: RegistryResourceSnapshot): Promise<void> {
    return this.#requireStore().saveResource(resource);
  }

  clear(): Promise<void> {
    return this.#requireStore().clear();
  }

  async close(): Promise<void> {
    await this.#store?.close();
    this.#store = undefined;
  }

  #requireStore(): RegistrySnapshotStore {
    if (this.#store === undefined) {
      throw new Error("Registry snapshot store is not open");
    }
    return this.#store;
  }
}

function cloneSnapshot(snapshot: RegistryEventSnapshot): RegistryEventSnapshot {
  return {
    ...snapshot,
    events: snapshot.events.map((event) => ({
      ...event,
      tags: event.tags.map((tag) => [...tag]),
    })),
    manifests: snapshot.manifests.map((manifest) => ({
      ...manifest,
      bytes: manifest.bytes.slice(),
    })),
  };
}

function cloneResource(
  resource: RegistryResourceSnapshot,
): RegistryResourceSnapshot {
  return { ...resource, bytes: resource.bytes.slice() };
}
