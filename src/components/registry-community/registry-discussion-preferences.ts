export interface RegistryDiscussionTopicCursor {
  eventId: string;
  createdAt: number;
}

export interface RegistryDiscussionTopicPreference {
  readCursor?: RegistryDiscussionTopicCursor;
  forcedUnread: boolean;
}

export interface RegistryDiscussionPreferences {
  version: 1;
  forumFirstSeenAt: number;
  composerHeight?: number;
  followed: boolean;
  bookmarked: boolean;
  topics: Readonly<Record<string, RegistryDiscussionTopicPreference>>;
}

interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storagePrefix = "lapismd.registry-discussion.preferences.v1";
const eventIdPattern = /^[0-9a-f]{64}$/u;
const minimumComposerHeight = 180;
const maximumComposerHeight = 1_200;

export function registryDiscussionPreferenceKey(
  relays: readonly string[],
  groupId: string,
  viewerPubkey: string,
): string {
  const relayScope = [...new Set(relays.map((relay) => relay.trim()))]
    .filter(Boolean)
    .toSorted()
    .join(",");
  const viewer = viewerPubkey.trim() || "anonymous";
  return [storagePrefix, relayScope, groupId.trim(), viewer]
    .map(encodeURIComponent)
    .join(":");
}

export function emptyRegistryDiscussionPreferences(
  now = Date.now(),
): RegistryDiscussionPreferences {
  return {
    version: 1,
    forumFirstSeenAt: Math.max(0, Math.floor(now / 1_000)),
    followed: false,
    bookmarked: false,
    topics: {},
  };
}

export function readRegistryDiscussionPreferences(
  storage: BrowserStorage,
  key: string,
  now = Date.now(),
): RegistryDiscussionPreferences {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return emptyRegistryDiscussionPreferences(now);
    const value: unknown = JSON.parse(raw);
    return sanitizePreferences(value, now);
  } catch {
    return emptyRegistryDiscussionPreferences(now);
  }
}

export function writeRegistryDiscussionPreferences(
  storage: BrowserStorage,
  key: string,
  preferences: RegistryDiscussionPreferences,
): boolean {
  try {
    storage.setItem(key, JSON.stringify(sanitizePreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}

export function advanceRegistryDiscussionTopicCursor(
  preferences: RegistryDiscussionPreferences,
  rootEventId: string,
  cursor: RegistryDiscussionTopicCursor,
): RegistryDiscussionPreferences {
  if (!eventIdPattern.test(rootEventId) || !validCursor(cursor)) {
    return preferences;
  }
  const current = preferences.topics[rootEventId];
  if (
    current?.readCursor !== undefined &&
    compareCursor(current.readCursor, cursor) >= 0
  ) {
    return current.forcedUnread
      ? {
          ...preferences,
          topics: {
            ...preferences.topics,
            [rootEventId]: { ...current, forcedUnread: false },
          },
        }
      : preferences;
  }
  return {
    ...preferences,
    topics: {
      ...preferences.topics,
      [rootEventId]: { readCursor: cursor, forcedUnread: false },
    },
  };
}

export function markRegistryDiscussionTopicUnread(
  preferences: RegistryDiscussionPreferences,
  rootEventId: string,
): RegistryDiscussionPreferences {
  if (!eventIdPattern.test(rootEventId)) return preferences;
  return {
    ...preferences,
    topics: {
      ...preferences.topics,
      [rootEventId]: {
        ...preferences.topics[rootEventId],
        forcedUnread: true,
      },
    },
  };
}

function sanitizePreferences(
  value: unknown,
  now = Date.now(),
): RegistryDiscussionPreferences {
  const fallback = emptyRegistryDiscussionPreferences(now);
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    value.version !== 1
  ) {
    return fallback;
  }
  const candidate = value as Record<string, unknown>;
  const topics: Record<string, RegistryDiscussionTopicPreference> = {};
  if (isRecord(candidate.topics)) {
    for (const [rootEventId, topic] of Object.entries(candidate.topics)) {
      if (!eventIdPattern.test(rootEventId) || !isRecord(topic)) continue;
      const cursor = validCursor(topic.readCursor)
        ? topic.readCursor
        : undefined;
      topics[rootEventId] = {
        ...(cursor === undefined ? {} : { readCursor: cursor }),
        forcedUnread: topic.forcedUnread === true,
      };
    }
  }
  const firstSeen = candidate.forumFirstSeenAt;
  const height = candidate.composerHeight;
  return {
    version: 1,
    forumFirstSeenAt:
      typeof firstSeen === "number" &&
      Number.isSafeInteger(firstSeen) &&
      firstSeen >= 0
        ? firstSeen
        : fallback.forumFirstSeenAt,
    ...(typeof height === "number" &&
    Number.isFinite(height) &&
    height >= minimumComposerHeight &&
    height <= maximumComposerHeight
      ? { composerHeight: Math.round(height) }
      : {}),
    followed: candidate.followed === true,
    bookmarked: candidate.bookmarked === true,
    topics,
  };
}

function validCursor(value: unknown): value is RegistryDiscussionTopicCursor {
  return (
    isRecord(value) &&
    typeof value.eventId === "string" &&
    eventIdPattern.test(value.eventId) &&
    typeof value.createdAt === "number" &&
    Number.isSafeInteger(value.createdAt) &&
    value.createdAt >= 0
  );
}

function compareCursor(
  left: RegistryDiscussionTopicCursor,
  right: RegistryDiscussionTopicCursor,
): number {
  return (
    left.createdAt - right.createdAt ||
    left.eventId.localeCompare(right.eventId)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
