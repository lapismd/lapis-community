import type { CommunityMessageModel } from "../community-workspace/model.js";

export const MESSAGE_GROUPING_WINDOW_MS = 10 * 60 * 1_000;

export function isMessageContinuation(
  messages: readonly CommunityMessageModel[],
  index: number,
): boolean {
  const previous = messages[index - 1];
  const current = messages[index];
  if (
    previous === undefined ||
    current === undefined ||
    previous.authorId !== current.authorId ||
    previous.createdAt === undefined ||
    current.createdAt === undefined
  ) {
    return false;
  }
  const previousTime = Date.parse(previous.createdAt);
  const currentTime = Date.parse(current.createdAt);
  if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime)) {
    return false;
  }
  const gap = currentTime - previousTime;
  return gap >= 0 && gap <= MESSAGE_GROUPING_WINDOW_MS;
}
