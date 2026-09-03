import type { CommunityMemberModel } from "../community-workspace/model.js";

export type CommunityNavigationItemKind =
  | "inbox"
  | "registry"
  | "channel"
  | "forum"
  | "direct-message";

export interface CommunityNavigationItemModel {
  id: string;
  label: string;
  kind: CommunityNavigationItemKind;
  icon?: string;
  member?: CommunityMemberModel;
  restricted?: boolean;
  unreadCount?: number;
  activityAt?: string;
  starred?: boolean;
  muted?: boolean;
  settingsDisabled?: boolean;
  leaveDisabled?: boolean;
  deleteDisabled?: boolean;
  settingsReason?: string;
  leaveReason?: string;
  deleteReason?: string;
}

export type CommunityNavigationItemAction =
  | "copy-link"
  | "copy-name"
  | "copy-id"
  | "mark-read"
  | "mark-unread"
  | "star"
  | "unstar"
  | "mute"
  | "unmute"
  | "hide"
  | "settings"
  | "leave"
  | "archive"
  | "delete"
  | "create-section"
  | `section:${string}`;

export interface CommunityNavigationCustomSectionOption {
  id: string;
  label: string;
}

export interface CommunityNavigationSectionModel {
  id: string;
  label: string;
  items: readonly CommunityNavigationItemModel[];
  primaryAction?: CommunityNavigationSectionActionModel;
  actions?: readonly CommunityNavigationSectionActionModel[];
  sortable?: boolean;
  initiallyCollapsed?: boolean;
}

export type CommunityNavigationSectionActionIcon =
  | "browse"
  | "browse-channels"
  | "browse-forums"
  | "compose";

export interface CommunityNavigationSectionActionModel {
  id: string;
  label: string;
  icon?: CommunityNavigationSectionActionIcon;
}

export type CommunityNavigationSortOrder = "alphabetical" | "recent";

export interface CommunityNavigationModel {
  searchPlaceholder?: string;
  primaryItems: readonly CommunityNavigationItemModel[];
  sections: readonly CommunityNavigationSectionModel[];
}

export function filterCommunityNavigation(
  model: CommunityNavigationModel,
  query: string,
): CommunityNavigationModel {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 0) return model;

  const matches = (item: CommunityNavigationItemModel) =>
    item.label.toLocaleLowerCase().includes(normalizedQuery);

  return {
    ...model,
    primaryItems: model.primaryItems.filter(matches),
    sections: model.sections
      .map((section) => ({
        ...section,
        items: section.items.filter(matches),
      }))
      .filter((section) => section.items.length > 0),
  };
}
