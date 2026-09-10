import { verifyEvent } from "nostr-tools/pure";

import type { NostrEvent } from "../protocol/index.js";
import type { ProjectForgeCatalog } from "./model.js";
import { materializeProjectForgeCatalog } from "./reducer.js";

const PROJECT_FORGE_CATALOG_CACHE_VERSION = 1 as const;
const PROJECT_FORGE_CATALOG_CACHE_EVENT_LIMIT = 20_000;

export interface ProjectForgeCatalogCacheScope {
  relayUrl: string;
  communityId: string;
  channelId?: string;
}

export interface ProjectForgeCatalogCacheSnapshot {
  catalog: ProjectForgeCatalog;
  cachedAt: number;
}

export interface ProjectForgeCatalogStore {
  load(
    scope: ProjectForgeCatalogCacheScope,
  ): Promise<ProjectForgeCatalogCacheSnapshot | undefined>;
  save(
    scope: ProjectForgeCatalogCacheScope,
    catalog: ProjectForgeCatalog,
  ): Promise<void>;
  clear(scope?: ProjectForgeCatalogCacheScope): Promise<void>;
}

export interface ProjectForgeCatalogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BrowserProjectForgeCatalogStoreOptions {
  storage?: ProjectForgeCatalogStorage;
  prefix?: string;
  now?: () => number;
}

export function createBrowserProjectForgeCatalogStore(
  options: BrowserProjectForgeCatalogStoreOptions = {},
): ProjectForgeCatalogStore {
  const storage = options.storage ?? discoverStorage();
  const prefix = options.prefix ?? "lapismd.community.projects.catalog.v1";
  const knownKeys = new Set<string>();
  const now = options.now ?? Date.now;

  return {
    async load(scope) {
      if (!storage) return undefined;
      const key = projectForgeCatalogCacheKey(scope, prefix);
      knownKeys.add(key);
      try {
        const serialized = storage.getItem(key);
        if (!serialized) return undefined;
        const value = JSON.parse(serialized) as unknown;
        const parsed = parseSnapshot(value, scope);
        if (parsed === undefined) storage.removeItem(key);
        return parsed;
      } catch {
        try {
          storage.removeItem(key);
        } catch {
          // Storage can become unavailable between reads and cleanup.
        }
        return undefined;
      }
    },
    async save(scope, catalog) {
      if (!storage) return;
      const key = projectForgeCatalogCacheKey(scope, prefix);
      knownKeys.add(key);
      try {
        storage.setItem(
          key,
          JSON.stringify({
            version: PROJECT_FORGE_CATALOG_CACHE_VERSION,
            relayUrl: normalizeRelayUrl(scope.relayUrl),
            communityId: scope.communityId,
            channelId: scope.channelId ?? "",
            cachedAt: now(),
            events: catalog.events,
          }),
        );
      } catch {
        // A full or disabled browser store must not block live project reads.
      }
    },
    async clear(scope) {
      if (!storage) return;
      const keys =
        scope === undefined
          ? [...knownKeys]
          : [projectForgeCatalogCacheKey(scope, prefix)];
      for (const key of keys) {
        try {
          storage.removeItem(key);
        } catch {
          // Clearing a best-effort cache remains best effort.
        }
        knownKeys.delete(key);
      }
    },
  };
}

export function projectForgeCatalogCacheKey(
  scope: ProjectForgeCatalogCacheScope,
  prefix = "lapismd.community.projects.catalog.v1",
): string {
  return [
    prefix,
    encodeURIComponent(normalizeRelayUrl(scope.relayUrl)),
    encodeURIComponent(scope.communityId),
    encodeURIComponent(scope.channelId ?? ""),
  ].join(":");
}

function parseSnapshot(
  value: unknown,
  scope: ProjectForgeCatalogCacheScope,
): ProjectForgeCatalogCacheSnapshot | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (
    record.version !== PROJECT_FORGE_CATALOG_CACHE_VERSION ||
    record.relayUrl !== normalizeRelayUrl(scope.relayUrl) ||
    record.communityId !== scope.communityId ||
    record.channelId !== (scope.channelId ?? "") ||
    typeof record.cachedAt !== "number" ||
    !Number.isFinite(record.cachedAt) ||
    record.cachedAt < 0 ||
    !Array.isArray(record.events) ||
    record.events.length > PROJECT_FORGE_CATALOG_CACHE_EVENT_LIMIT
  ) {
    return undefined;
  }
  const events: NostrEvent[] = [];
  for (const candidate of record.events) {
    const event = parseVerifiedEvent(candidate);
    if (event === undefined) return undefined;
    events.push(event);
  }
  return {
    catalog: materializeProjectForgeCatalog(events),
    cachedAt: record.cachedAt,
  };
}

function parseVerifiedEvent(value: unknown): NostrEvent | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const event = value as Record<string, unknown>;
  if (
    typeof event.id !== "string" ||
    typeof event.pubkey !== "string" ||
    typeof event.created_at !== "number" ||
    typeof event.kind !== "number" ||
    !Array.isArray(event.tags) ||
    !event.tags.every(
      (tag) =>
        Array.isArray(tag) && tag.every((item) => typeof item === "string"),
    ) ||
    typeof event.content !== "string" ||
    typeof event.sig !== "string"
  ) {
    return undefined;
  }
  try {
    return verifyEvent(event as unknown as NostrEvent)
      ? (event as unknown as NostrEvent)
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRelayUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return value.trim();
  }
}

function discoverStorage(): ProjectForgeCatalogStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
