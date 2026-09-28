import type { CommunityMessageModel } from "../community-workspace/model.js";

export const MESSAGE_GROUPING_WINDOW_MS = 10 * 60 * 1_000;

export type MessageGroupingOptions = {
  startsNewGroup?: boolean;
};

export function firstUnreadMessageId(
  messages: readonly CommunityMessageModel[],
  unreadEventIds: readonly string[] | undefined,
): string | undefined {
  if (unreadEventIds === undefined || unreadEventIds.length === 0) {
    return undefined;
  }
  const unreadIds = new Set(unreadEventIds);
  return messages.find((message) => unreadIds.has(message.id))?.id;
}

export function isMessageContinuation(
  messages: readonly CommunityMessageModel[],
  index: number,
  options: MessageGroupingOptions = {},
): boolean {
  const previous = messages[index - 1];
  const current = messages[index];
  if (
    options.startsNewGroup === true ||
    previous === undefined ||
    current === undefined ||
    previous.activity !== undefined ||
    current.activity !== undefined ||
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
