import type { CommunityMessageModel } from "../community-workspace/model.js";

/** A missing ancestor still has a known ID; never substitute the span ID. */
export function contextThreadRoot(
  messages: readonly CommunityMessageModel[],
  requestId: string,
): string | undefined {
  const byId = new Map(messages.map((message) => [message.id, message]));
  if (!byId.has(requestId)) return;
  const visited = new Set<string>();
  let id = requestId;
  while (!visited.has(id)) {
    visited.add(id);
    const message = byId.get(id);
    const root = message?.sourceEvent?.tags.find(
      (tag) => tag[0] === "e" && tag[3] === "root",
    )?.[1];
    const parent = root ?? message?.parentMessageId;
    if (!parent) return id;
    id = parent;
  }
  return;
}
