import {
  buildCommunityChannelLink,
  buildCommunityProjectLink,
  buildCommunityRepoLink,
  buildCommunityTaskLink,
  type CommunityEntityLinkIcon,
} from "../../community/community-links.js";
import type { CommunityRoomModel } from "../community-workspace/model.js";
import type { CommunityComposerAutocompleteItem } from "./autocomplete.js";
import {
  COMPOSER_SLASH_KIND_ALIASES,
  parseComposerSlashQuery,
  type ComposerSlashKind,
} from "./composer-slash.js";
import type { ComposerSlashSession } from "./composer-slash-session.js";

export interface ComposerSlashCatalog extends ComposerSlashSession {}

export const COMPOSER_SLASH_CATEGORIES: readonly {
  kind: ComposerSlashKind;
  label: string;
  icon: CommunityEntityLinkIcon;
}[] = [
  { kind: "repositories", label: "Repositories", icon: "folder-git-2" },
  { kind: "projects", label: "Projects", icon: "folder-kanban" },
  { kind: "tasks", label: "Tasks", icon: "circle-dot" },
  { kind: "commits", label: "Commits", icon: "git-commit-horizontal" },
  { kind: "logs", label: "Logs", icon: "history" },
  { kind: "channels", label: "Channels", icon: "hash" },
];

export function mergeComposerSlashCatalog(
  rooms: readonly CommunityRoomModel[],
  session: ComposerSlashSession,
): ComposerSlashCatalog {
  return {
    ...session,
    rooms: session.rooms.length > 0 ? session.rooms : rooms,
  };
}

export function composerSlashAutocompleteItems(
  query: string,
  catalog: ComposerSlashCatalog,
): CommunityComposerAutocompleteItem[] {
  const parsed = parseComposerSlashQuery(query);
  if (parsed.stage === "category") {
    const filter = parsed.filter.toLocaleLowerCase();
    return COMPOSER_SLASH_CATEGORIES.filter((category) =>
      categoryMatches(category, filter),
    ).map((category) =>
      slashAutocompleteItem({
        id: `slash:category:${category.kind}`,
        label: category.label,
      }),
    );
  }
  return slashEntries(parsed.kind!, parsed.filter, catalog);
}

export function composerSlashItemKind(
  item: CommunityComposerAutocompleteItem,
): ComposerSlashKind | undefined {
  const category = /^slash:category:(.+)$/u.exec(item.id);
  if (category) return category[1] as ComposerSlashKind;
  return undefined;
}

export function composerSlashItemHref(
  item: CommunityComposerAutocompleteItem,
): string | undefined {
  return item.id.startsWith("slash:entry:")
    ? item.id.slice("slash:entry:".length)
    : undefined;
}

function slashEntries(
  kind: ComposerSlashKind,
  filter: string,
  catalog: ComposerSlashCatalog,
): CommunityComposerAutocompleteItem[] {
  const normalized = filter.trim().toLocaleLowerCase();
  const rows = entryRows(kind, catalog).filter((row) =>
    `${row.label} ${row.detail ?? ""}`.toLocaleLowerCase().includes(normalized),
  );
  return rows.slice(0, 24).map((row) =>
    slashAutocompleteItem({
      id: `slash:entry:${row.href}`,
      label: row.label,
      detail: row.detail,
    }),
  );
}

function entryRows(
  kind: ComposerSlashKind,
  catalog: ComposerSlashCatalog,
): Array<{ label: string; detail?: string; href: string }> {
  if (kind === "channels") {
    return catalog.rooms
      .filter((room) => room.kind !== "direct" && room.archived !== true)
      .map((room) => ({
        label: room.name,
        detail: room.kind === "forum" ? "Forum" : "Channel",
        href: buildCommunityChannelLink(room.id),
      }));
  }
  if (kind === "projects") {
    return catalog.projects.map((project) => ({
      label: project.name,
      detail: project.d,
      href: buildCommunityProjectLink(project),
    }));
  }
  if (kind === "repositories") {
    return catalog.repositories.map((repository) => ({
      label: repository.name,
      detail: repository.d,
      href: buildCommunityRepoLink(repository),
    }));
  }
  if (kind === "tasks") {
    return catalog.tasks.map((task) => ({
      label: task.title,
      detail: task.d,
      href: buildCommunityTaskLink(task),
    }));
  }
  if (kind === "commits") {
    return catalog.commits.map((commit) => ({
      label: commit.subject,
      detail: commit.sha.slice(0, 8),
      href: buildCommunityRepoLink({
        owner: commit.owner,
        d: commit.d,
        tab: "commits",
        commit: commit.sha,
      }),
    }));
  }
  return catalog.logs.map((log) => ({
    label: log.label,
    detail: log.tab === "oplog" ? "Op Log" : "Log",
    href: buildCommunityRepoLink({
      owner: log.owner,
      d: log.d,
      tab: log.tab,
    }),
  }));
}

function categoryMatches(
  category: (typeof COMPOSER_SLASH_CATEGORIES)[number],
  filter: string,
): boolean {
  if (filter === "") return true;
  return (
    category.label.toLocaleLowerCase().startsWith(filter) ||
    COMPOSER_SLASH_KIND_ALIASES[category.kind].some((alias) =>
      alias.startsWith(filter),
    )
  );
}

function slashAutocompleteItem(input: {
  id: string;
  label: string;
  detail?: string;
}): CommunityComposerAutocompleteItem {
  return {
    id: input.id,
    kind: "slash",
    label: input.label,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
  };
}
