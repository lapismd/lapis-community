import type {
  CommunityInboxItemModel,
  CommunityInboxModel,
} from "../community-inbox/model.js";

type InboxPendingMessage = {
  id: string;
  parentMessageId?: string;
  activity?: unknown;
};

function inboxMessageReachesRoot(
  message: Pick<InboxPendingMessage, "id" | "parentMessageId">,
  rootId: string,
  byId: ReadonlyMap<string, Pick<InboxPendingMessage, "parentMessageId">>,
): boolean {
  if (message.id === rootId) return true;
  let current = message.parentMessageId;
  const seen = new Set<string>();
  while (current) {
    if (current === rootId) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    const parent = byId.get(current);
    if (!parent) return false;
    current = parent.parentMessageId;
  }
  return false;
}

export function inboxMessagesBelongToItem(
  messages: readonly InboxPendingMessage[],
  item: Pick<CommunityInboxItemModel, "rootEventId" | "latestEventId">,
): boolean {
  const conversation = messages.filter((message) => message.activity == null);
  if (conversation.length === 0) return false;
  const rootId = item.rootEventId;
  const latestId = item.latestEventId;
  if (!rootId && !latestId) return false;
  if (latestId && !conversation.some((message) => message.id === latestId))
    return false;
  if (!latestId && !conversation.some((message) => message.id === rootId))
    return false;
  if (!rootId) return true;
  const byId = new Map(
    conversation.map((message) => [message.id, message] as const),
  );
  return conversation.every(
    (message) =>
      inboxMessageReachesRoot(message, rootId, byId) ||
      (latestId !== undefined &&
        inboxMessageReachesRoot(message, latestId, byId)),
  );
}

export function inboxConversationPending(
  model: Pick<
    CommunityInboxModel,
    "activeItemId" | "items" | "selectedItem"
  > & { messages: readonly InboxPendingMessage[] },
  requestedItemId?: string,
): boolean {
  const selectedId = requestedItemId ?? model.activeItemId;
  if (!selectedId) return false;
  if (model.activeItemId !== selectedId) return true;
  const item =
    model.selectedItem?.id === selectedId
      ? model.selectedItem
      : model.items.find((row) => row.id === selectedId);
  if (!item) return true;
  if (model.messages.length === 0)
    return Boolean(item.rootEventId || item.latestEventId);
  if (!item.rootEventId && !item.latestEventId) return false;
  return !inboxMessagesBelongToItem(model.messages, item);
}
