import type {
  CommunityInboxItemModel,
  CommunityInboxModel,
} from "../community-inbox/model.js";

export function inboxMessagesBelongToItem(
  messages: readonly { id: string; parentMessageId?: string }[],
  item: Pick<CommunityInboxItemModel, "rootEventId" | "latestEventId">,
): boolean {
  const ids = new Set(
    [item.rootEventId, item.latestEventId].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    ),
  );
  if (ids.size === 0) return false;
  return messages.some(
    (message) =>
      ids.has(message.id) ||
      (item.rootEventId !== undefined &&
        message.parentMessageId === item.rootEventId),
  );
}

export function inboxConversationPending(
  model: Pick<
    CommunityInboxModel,
    "activeItemId" | "items" | "messages" | "selectedItem"
  >,
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
  if (model.messages.length === 0) return false;
  if (!item.rootEventId && !item.latestEventId) return false;
  return !inboxMessagesBelongToItem(model.messages, item);
}
