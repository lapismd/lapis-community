import type { ProjectForgeCatalogStorage } from "./catalog-store.js";

const REVIEW_PREFERENCE_VERSION = 1 as const;
const DEFAULT_PREFIX = "lapismd.community.projects.review.v1";
const MAX_VIEWED_FILES = 10_000;

export type ProjectReviewDiffViewMode = "unified" | "split";

export interface ProjectReviewPreferenceScope {
  relayUrl: string;
  communityId: string;
  memberId: string;
}

export interface ProjectReviewViewedFilesScope
  extends ProjectReviewPreferenceScope {
  repository: string;
  pullRequestId: string;
  base: string;
  head: string;
}

export interface ProjectReviewPreferenceStore {
  loadDiffViewMode(
    scope: ProjectReviewPreferenceScope,
  ): ProjectReviewDiffViewMode | undefined;
  saveDiffViewMode(
    scope: ProjectReviewPreferenceScope,
    mode: ProjectReviewDiffViewMode,
  ): void;
  loadViewedFiles(scope: ProjectReviewViewedFilesScope): readonly string[];
  saveViewedFiles(
    scope: ProjectReviewViewedFilesScope,
    paths: readonly string[],
  ): void;
}

export interface BrowserProjectReviewPreferenceStoreOptions {
  storage?: ProjectForgeCatalogStorage;
  prefix?: string;
}

export function createBrowserProjectReviewPreferenceStore(
  options: BrowserProjectReviewPreferenceStoreOptions = {},
): ProjectReviewPreferenceStore {
  const storage = options.storage ?? discoverStorage();
  const prefix = options.prefix ?? DEFAULT_PREFIX;

  return {
    loadDiffViewMode(scope) {
      const value = read(storage, diffViewModeKey(scope, prefix));
      return value === "unified" || value === "split" ? value : undefined;
    },
    saveDiffViewMode(scope, mode) {
      write(storage, diffViewModeKey(scope, prefix), mode);
    },
    loadViewedFiles(scope) {
      const value = read(storage, viewedFilesKey(scope, prefix));
      if (!Array.isArray(value) || value.length > MAX_VIEWED_FILES) return [];
      const paths = value.filter(
        (path): path is string =>
          typeof path === "string" && path.length > 0 && path.length <= 4_096,
      );
      return paths.length === value.length ? [...new Set(paths)] : [];
    },
    saveViewedFiles(scope, paths) {
      write(
        storage,
        viewedFilesKey(scope, prefix),
        [...new Set(paths)].slice(0, MAX_VIEWED_FILES),
      );
    },
  };
}

export function projectReviewDiffViewModeKey(
  scope: ProjectReviewPreferenceScope,
  prefix = DEFAULT_PREFIX,
): string {
  return diffViewModeKey(scope, prefix);
}

export function projectReviewViewedFilesKey(
  scope: ProjectReviewViewedFilesScope,
  prefix = DEFAULT_PREFIX,
): string {
  return viewedFilesKey(scope, prefix);
}

function diffViewModeKey(
  scope: ProjectReviewPreferenceScope,
  prefix: string,
): string {
  return [
    prefix,
    "mode",
    encode(normalizeRelayUrl(scope.relayUrl)),
    encode(scope.communityId),
    encode(scope.memberId),
  ].join(":");
}

function viewedFilesKey(
  scope: ProjectReviewViewedFilesScope,
  prefix: string,
): string {
  return [
    prefix,
    "viewed",
    encode(normalizeRelayUrl(scope.relayUrl)),
    encode(scope.communityId),
    encode(scope.memberId),
    encode(scope.repository),
    encode(scope.pullRequestId),
    encode(scope.base),
    encode(scope.head),
  ].join(":");
}

function read(
  storage: ProjectForgeCatalogStorage | undefined,
  key: string,
): unknown {
  if (!storage) return undefined;
  try {
    const serialized = storage.getItem(key);
    return serialized === null
      ? undefined
      : normalizeStoredValue(JSON.parse(serialized));
  } catch {
    return undefined;
  }
}

function write(
  storage: ProjectForgeCatalogStorage | undefined,
  key: string,
  value: unknown,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({ version: REVIEW_PREFERENCE_VERSION, value }),
    );
  } catch {
    return;
  }
}

function normalizeStoredValue(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  return record.version === REVIEW_PREFERENCE_VERSION
    ? record.value
    : undefined;
}

function encode(value: string): string {
  return encodeURIComponent(value.trim());
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
