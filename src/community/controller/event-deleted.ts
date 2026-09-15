import type { NostrEvent } from "../../protocol/index.js";

export function eventDeleted(
  events: readonly NostrEvent[],
  eventId: string,
): boolean {
  return events.some(
    (event) =>
      (event.kind === 5 || event.kind === 9_005) &&
      event.tags.some((tag) => tag[0] === "e" && tag[1] === eventId),
  );
}
