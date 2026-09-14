import type { CommunityMemberModel } from "../community-workspace/model.js";

export type CommunityNavigationItemKind =
  | "inbox"
  | "pulse"
  | "registry"
  | "projects"
  | "agents"
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
  /** False means cached history only establishes a lower bound. */
  unreadComplete?: boolean;
  activityAt?: string;
  starred?: boolean;
  muted?: boolean;
  settingsDisabled?: boolean;
  leaveDisabled?: boolean;
  deleteDisabled?: boolean;
  archiveAvailable?: boolean;
  settingsReason?: string;
  leaveReason?: string;
  deleteReason?: string;
  children?: readonly CommunityNavigationItemModel[];
  initiallyExpanded?: boolean;
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

export type CommunityNavigationSectionKind =
  | "starred"
  | "projects"
  | "channels"
  | "forums"
  | "direct-messages"
  | "section";

export interface CommunityNavigationSectionModel {
  id: string;
  label: string;
  kind?: CommunityNavigationSectionKind;
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
  | "compose"
  | "create"
  | "join-invite"
  | "new-section"
  | "rename"
  | "delete";

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

export function communityNavigationSectionKind(
  section: CommunityNavigationSectionModel,
): CommunityNavigationSectionKind {
  if (section.kind) return section.kind;
  if (section.id === "starred") return "starred";
  if (section.id === "projects") return "projects";
  if (section.id === "channels") return "channels";
  if (section.id === "forums") return "forums";
  if (section.id === "direct-messages") return "direct-messages";
  return "section";
}

export function withStarredCommunityNavigationSection(
  sections: readonly CommunityNavigationSectionModel[],
): readonly CommunityNavigationSectionModel[] {
  const seen = new Set<string>();
  const starredItems = sections
    .filter((section) => communityNavigationSectionKind(section) !== "starred")
    .flatMap((section) => section.items)
    .filter((item) => {
      if (
        !item.starred ||
        (item.kind !== "channel" && item.kind !== "forum") ||
        seen.has(item.id)
      ) {
        return false;
      }
      seen.add(item.id);
      return true;
    });

  const remaining = sections.filter(
    (section) => communityNavigationSectionKind(section) !== "starred",
  );
  if (starredItems.length === 0) return remaining;

  return [
    {
      id: "starred",
      label: "Starred",
      kind: "starred",
      items: starredItems,
    },
    ...remaining,
  ];
}

export function filterCommunityNavigation(
  model: CommunityNavigationModel,
  query: string,
): CommunityNavigationModel {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 0) return model;

  const matches = (item: CommunityNavigationItemModel) =>
    item.label.toLocaleLowerCase().includes(normalizedQuery);

  const filterItem = (
    item: CommunityNavigationItemModel,
  ): CommunityNavigationItemModel | undefined => {
    if (matches(item)) return item;
    const children = item.children?.filter(matches) ?? [];
    return children.length > 0 ? { ...item, children } : undefined;
  };

  return {
    ...model,
    primaryItems: model.primaryItems.filter(matches),
    sections: model.sections
      .map((section) => ({
        ...section,
        items: section.items
          .map(filterItem)
          .filter(
            (item): item is CommunityNavigationItemModel => item !== undefined,
          ),
      }))
      .filter((section) => section.items.length > 0),
  };
}
