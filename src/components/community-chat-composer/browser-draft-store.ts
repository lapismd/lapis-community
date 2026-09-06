import type {
  CommunityComposerDraft,
  CommunityComposerDraftStore,
} from "./model.js";

interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const defaultPrefix = "lapismd.community-composer.draft.v1";

export function createBrowserCommunityComposerDraftStore(
  storage: BrowserStorage = window.localStorage,
  prefix = defaultPrefix,
): CommunityComposerDraftStore {
  const storageKey = (key: string) => `${prefix}:${encodeURIComponent(key)}`;
  return {
    async load(key) {
      try {
        const raw = storage.getItem(storageKey(key));
        if (raw === null) return undefined;
        return sanitizeDraft(JSON.parse(raw));
      } catch {
        return undefined;
      }
    },
    async save(key, draft) {
      const safe = sanitizeDraft(draft);
      if (safe === undefined) return;
      storage.setItem(storageKey(key), JSON.stringify(safe));
    },
    async remove(key) {
      storage.removeItem(storageKey(key));
    },
  };
}

function sanitizeDraft(value: unknown): CommunityComposerDraft | undefined {
  if (!isRecord(value) || typeof value.value !== "string") return undefined;
  if (value.value.length > 100_000) return undefined;
  const updatedAt = value.updatedAt;
  return {
    value: value.value,
    mentionPubkeys: safeStrings(value.mentionPubkeys),
    channelIds: safeStrings(value.channelIds),
    attachments: [],
    updatedAt:
      typeof updatedAt === "number" && Number.isFinite(updatedAt)
        ? updatedAt
        : Date.now(),
  };
}

function safeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length <= 512,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
