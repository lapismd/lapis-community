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
  restricted?: boolean;
  unreadCount?: number;
  activityAt?: string;
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

export type CommunityNavigationSectionActionIcon = "browse" | "compose";

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
