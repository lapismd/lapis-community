import type {
  CommunityInboxModel,
  CommunityInboxItemModel,
} from "./inbox-model.js";

/** Unread-only retains the selected read row when it matches the category. */
export function isInboxItemVisible(
  item: CommunityInboxItemModel,
  selection: Partial<
    Pick<CommunityInboxModel, "filter" | "unreadOnly" | "activeItemId">
  >,
): boolean {
  const filter = selection.filter ?? "All";
  return (
    (filter === "All" || item.categories?.includes(filter) === true) &&
    (!selection.unreadOnly ||
      item.unread === true ||
      item.id === selection.activeItemId)
  );
}
