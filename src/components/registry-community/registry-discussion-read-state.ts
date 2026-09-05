export interface RegistryDiscussionReadCursor {
  eventId: string;
  createdAt: number;
}

interface StoredRegistryDiscussionReadCursor
  extends RegistryDiscussionReadCursor {
  version: 1;
}

interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storagePrefix = "lapismd.registry-discussion.last-read.v1";
const eventIdPattern = /^[0-9a-f]{64}$/u;

export function registryDiscussionReadKey(
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

export function readRegistryDiscussionCursor(
  storage: BrowserStorage,
  key: string,
): RegistryDiscussionReadCursor | undefined {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return undefined;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== 1 ||
      !("eventId" in value) ||
      typeof value.eventId !== "string" ||
      !eventIdPattern.test(value.eventId) ||
      !("createdAt" in value) ||
      typeof value.createdAt !== "number" ||
      !Number.isSafeInteger(value.createdAt) ||
      value.createdAt < 0
    ) {
      return undefined;
    }
    return { eventId: value.eventId, createdAt: value.createdAt };
  } catch {
    return undefined;
  }
}

export function writeRegistryDiscussionCursor(
  storage: BrowserStorage,
  key: string,
  cursor: RegistryDiscussionReadCursor,
): boolean {
  if (
    !eventIdPattern.test(cursor.eventId) ||
    !Number.isSafeInteger(cursor.createdAt) ||
    cursor.createdAt < 0
  ) {
    return false;
  }
  const current = readRegistryDiscussionCursor(storage, key);
  if (
    current !== undefined &&
    (current.createdAt > cursor.createdAt ||
      (current.createdAt === cursor.createdAt &&
        current.eventId.localeCompare(cursor.eventId) >= 0))
  ) {
    return false;
  }
  const value: StoredRegistryDiscussionReadCursor = {
    version: 1,
    ...cursor,
  };
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
