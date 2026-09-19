import type { NostrEvent } from "../protocol/index.js";
export function exactEventTag(
  event: NostrEvent,
  name: string,
): string | undefined {
  const tags = event.tags.filter((tag) => tag[0] === name);
  return tags.length === 1 && tags[0]?.length === 2 && tags[0][1]
    ? tags[0][1]
    : undefined;
}
