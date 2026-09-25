export type ProjectListCursor =
  | { kind: "event"; createdAt: number; eventId: string }
  | { kind: "commit"; sha: string }
  | { kind: "row"; id: string };

const EVENT_ID_PATTERN = /^[a-f0-9]{64}$/u;
const SHA_PATTERN = /^[a-f0-9]{40,64}$/u;
const ROW_ID_PATTERN = /^[A-Za-z0-9._:@/-]{1,256}$/u;

export function encodeProjectListCursor(
  cursor: ProjectListCursor | undefined,
): string | undefined {
  if (!cursor) return undefined;
  if (cursor.kind === "event")
    return `event:${cursor.createdAt}:${cursor.eventId}`;
  if (cursor.kind === "commit") return `commit:${cursor.sha}`;
  return `row:${encodeURIComponent(cursor.id)}`;
}

export function decodeProjectListCursor(
  value: string | undefined,
): ProjectListCursor | undefined {
  if (!value) return undefined;
  const [kind, first, second] = value.split(":");
  if (kind === "event" && first && second) {
    const createdAt = Number(first);
    return Number.isInteger(createdAt) &&
      createdAt > 0 &&
      EVENT_ID_PATTERN.test(second)
      ? { kind, createdAt, eventId: second }
      : undefined;
  }
  if (kind === "commit" && first && SHA_PATTERN.test(first))
    return { kind, sha: first };
  if (kind === "row" && first) {
    const id = decodeURIComponent(first);
    return ROW_ID_PATTERN.test(id) ? { kind, id } : undefined;
  }
  return undefined;
}

export function projectEventCursorFields(
  cursor: ProjectListCursor | undefined,
): { until?: number; before_id?: string } {
  return cursor?.kind === "event"
    ? { until: cursor.createdAt, before_id: cursor.eventId }
    : {};
}
