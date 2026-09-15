import type { CommunityNavigationSectionModel } from "../community-navigation/model.js";
import { withStarredCommunityNavigationSection } from "../community-navigation/model.js";
import { isProjectDestination } from "./navigation.js";

type SectionStorage = Pick<Storage, "getItem" | "setItem">;
export type NavigationSectionState = Record<string, boolean>;

export function navigationSectionStorageKey(
  communityId: string,
  relayUrl: string,
  memberId: string,
): string {
  return `@lapismd/lapis-community/navigation-sections/${JSON.stringify([communityId, relayUrl, memberId])}`;
}

export function loadNavigationSections(
  storage: SectionStorage | undefined,
  key: string,
): NavigationSectionState {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key) ?? "null");
    if (
      !value ||
      typeof value !== "object" ||
      !("version" in value) ||
      value.version !== 1 ||
      !("sections" in value)
    )
      return {};
    const sections = value.sections;
    if (!sections || typeof sections !== "object" || Array.isArray(sections))
      return {};
    const entries = Object.entries(sections);
    if (entries.some(([, open]) => typeof open !== "boolean")) return {};
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function saveNavigationSections(
  storage: SectionStorage | undefined,
  key: string,
  sections: NavigationSectionState,
): void {
  try {
    storage?.setItem(key, JSON.stringify({ version: 1, sections }));
  } catch {
    // Layout preferences remain usable when browser storage is unavailable.
  }
}

/** Put direct messages before Projects while retaining starred shortcuts first. */
export function orderNavigationSections(
  sections: readonly CommunityNavigationSectionModel[],
): readonly CommunityNavigationSectionModel[] {
  return withStarredCommunityNavigationSection([
    ...sections.filter((section) => section.id === "direct-messages"),
    ...sections.filter((section) => section.id !== "direct-messages"),
  ]);
}

/** Resolve after the destination's asynchronously loaded rows become available. */
export function sectionsForDestination(
  sections: readonly CommunityNavigationSectionModel[],
  destination: string,
): readonly string[] {
  return sections
    .filter((section) => section.id !== "starred")
    .filter(
      (section) =>
        (section.id === "projects" && isProjectDestination(destination)) ||
        section.items.some(
          (item) =>
            item.id === destination ||
            item.children?.some((child) => child.id === destination),
        ),
    )
    .map((section) => section.id);
}
