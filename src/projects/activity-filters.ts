import type { ProjectForgeCatalogStorage } from "./catalog-store.js";
import {
  PROJECT_FORGE_KINDS,
  type ProjectForgeActivityItem,
  type ProjectForgeActivityKind,
} from "./model.js";
import { KIND_JJ_OPERATION } from "./work-item-filters.js";

export const PROJECT_ACTIVITY_FILTER_DEFAULT = "all" as const;
export const PROJECT_ACTIVITY_WEEK_SECONDS = 604_800;
export const PROJECT_ACTIVITY_FILTER_STORAGE_PREFIX =
  "lapismd.community.projects.activity-filter";
export const PROJECT_ACTIVITY_FILTER_STORAGE_KEY =
  `${PROJECT_ACTIVITY_FILTER_STORAGE_PREFIX}.v1`;
export const PROJECT_ACTIVITY_FILTER_PAGES = [
  "projects",
  "project",
  "repositories",
] as const;

export type ProjectActivityFilterPage =
  (typeof PROJECT_ACTIVITY_FILTER_PAGES)[number];

export type ProjectActivityFilterId =
  | typeof PROJECT_ACTIVITY_FILTER_DEFAULT
  | ProjectForgeActivityKind;

export interface ProjectActivityFilterOption {
  id: ProjectActivityFilterId;
  label: string;
  description: string;
}

export const PROJECT_ACTIVITY_FILTERS = [
  {
    id: "all",
    label: "All activity",
    description: "Every relay-backed project event",
  },
  {
    id: "project",
    label: "Projects",
    description: `Kind ${PROJECT_FORGE_KINDS.project} project announcements`,
  },
  {
    id: "repository",
    label: "Repositories",
    description: `Kind ${PROJECT_FORGE_KINDS.repository} repository announcements`,
  },
  {
    id: "task",
    label: "Tasks",
    description: `Kind ${PROJECT_FORGE_KINDS.task} work items`,
  },
  {
    id: "assignment",
    label: "Task assignments",
    description: `Kind ${PROJECT_FORGE_KINDS.note} assignment notes`,
  },
  {
    id: "comment",
    label: "Comments",
    description: `Kind ${PROJECT_FORGE_KINDS.note} and ${PROJECT_FORGE_KINDS.comment} notes`,
  },
  {
    id: "review",
    label: "Reviews",
    description: `Kind ${PROJECT_FORGE_KINDS.pullRequest} pull requests`,
  },
  {
    id: "review-update",
    label: "Review updates",
    description: `Kind ${PROJECT_FORGE_KINDS.pullRequestUpdate} patch updates`,
  },
  {
    id: "approval",
    label: "Review approvals",
    description: `Kind ${PROJECT_FORGE_KINDS.note} trusted approvals`,
  },
  {
    id: "changes-requested",
    label: "Changes requested",
    description: `Kind ${PROJECT_FORGE_KINDS.note} trusted change requests`,
  },
  {
    id: "review-request",
    label: "Review requests",
    description: `Kind ${PROJECT_FORGE_KINDS.note} trusted review requests`,
  },
  {
    id: "commit",
    label: "Commits",
    description: `Dest-Git commits and kind ${KIND_JJ_OPERATION} jj-sync operations`,
  },
] as const satisfies readonly ProjectActivityFilterOption[];

export const PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT: readonly ProjectActivityFilterId[] =
  [PROJECT_ACTIVITY_FILTER_DEFAULT];

export interface ProjectActivityFilterStore {
  load(): ProjectActivityFilterId[];
  save(value: readonly ProjectActivityFilterId[]): void;
}

export function isProjectActivityFilterId(
  value: unknown,
): value is ProjectActivityFilterId {
  return PROJECT_ACTIVITY_FILTERS.some((option) => option.id === value);
}

export function normalizeProjectActivityFilters(
  values: readonly unknown[],
): ProjectActivityFilterId[] {
  const ids = values.filter(isProjectActivityFilterId);
  if (ids.length === 0 || ids.includes(PROJECT_ACTIVITY_FILTER_DEFAULT)) {
    return [...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT];
  }
  return PROJECT_ACTIVITY_FILTERS.map((option) => option.id).filter(
    (id) => id !== PROJECT_ACTIVITY_FILTER_DEFAULT && ids.includes(id),
  );
}

export function isProjectActivityFilterAll(
  selection: readonly ProjectActivityFilterId[],
): boolean {
  return (
    selection.length === 0 ||
    selection.includes(PROJECT_ACTIVITY_FILTER_DEFAULT)
  );
}

export function isProjectActivityFilterSelected(
  selection: readonly ProjectActivityFilterId[],
  id: ProjectActivityFilterId,
): boolean {
  return id === PROJECT_ACTIVITY_FILTER_DEFAULT
    ? isProjectActivityFilterAll(selection)
    : !isProjectActivityFilterAll(selection) && selection.includes(id);
}

export function visibleProjectActivityFilters(
  selection: readonly ProjectActivityFilterId[],
): ProjectActivityFilterOption[] {
  const selected: ProjectActivityFilterOption[] = [];
  const rest: ProjectActivityFilterOption[] = [];
  for (const option of PROJECT_ACTIVITY_FILTERS) {
    if (isProjectActivityFilterSelected(selection, option.id)) {
      selected.push(option);
    } else {
      rest.push(option);
    }
  }
  return [...selected, ...rest];
}

export function toggleProjectActivityFilter(
  selection: readonly ProjectActivityFilterId[],
  id: ProjectActivityFilterId,
): ProjectActivityFilterId[] {
  if (id === PROJECT_ACTIVITY_FILTER_DEFAULT) {
    return [...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT];
  }
  const current = new Set(
    isProjectActivityFilterAll(selection)
      ? []
      : selection.filter((value) => value !== PROJECT_ACTIVITY_FILTER_DEFAULT),
  );
  if (current.has(id)) current.delete(id);
  else current.add(id);
  return normalizeProjectActivityFilters([...current]);
}

export function filterProjectActivity(
  activity: readonly ProjectForgeActivityItem[],
  filters: readonly ProjectActivityFilterId[],
): ProjectForgeActivityItem[] {
  if (isProjectActivityFilterAll(filters)) return [...activity];
  const kinds = new Set(filters);
  return activity.filter((item) => kinds.has(item.kind));
}

export function projectActivityWeekItems(
  activity: readonly ProjectForgeActivityItem[],
  now = Date.now(),
): ProjectForgeActivityItem[] {
  const cutoff = Math.floor(now / 1_000) - PROJECT_ACTIVITY_WEEK_SECONDS;
  return activity.filter((item) => item.createdAt >= cutoff);
}

export function projectActivityDigest(
  activity: readonly ProjectForgeActivityItem[],
  now = Date.now(),
): string {
  const week = projectActivityWeekItems(activity, now);
  const taskCount = week.filter((item) => item.kind === "task").length;
  const reviewCount = week.filter((item) => item.kind === "review").length;
  const projectCount = new Set(week.map((item) => item.projectCoordinate)).size;
  const highlights = [
    taskCount > 0
      ? `${taskCount} ${taskCount === 1 ? "task" : "tasks"} opened`
      : "",
    reviewCount > 0
      ? `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"} opened`
      : "",
    `${projectCount} active ${projectCount === 1 ? "project" : "projects"}`,
  ].filter(Boolean);
  const detail =
    highlights.length === 1
      ? highlights[0]
      : `${highlights.slice(0, -1).join(", ")}, and ${highlights.at(-1)}`;
  return `This week: ${detail}.`;
}

export function projectActivityFilterStorageKey(
  page: ProjectActivityFilterPage,
): string {
  return `${PROJECT_ACTIVITY_FILTER_STORAGE_PREFIX}.${page}.v1`;
}

export function projectActivityFilterPage(selection: {
  selectedProject?: unknown;
  selectedRepository?: unknown;
}): ProjectActivityFilterPage {
  if (selection.selectedRepository) return "repositories";
  if (selection.selectedProject) return "project";
  return "projects";
}

export function createBrowserProjectActivityFilterStore(options: {
  storage?: ProjectForgeCatalogStorage | undefined;
  page?: ProjectActivityFilterPage | undefined;
} = {}): ProjectActivityFilterStore {
  const storage = options.storage ?? discoverStorage();
  const page = options.page ?? "projects";
  return {
    load() {
      return (
        readStoredFilter(storage, page) ?? [
          ...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
        ]
      );
    },
    save(value) {
      writeStoredFilter(storage, page, value);
    },
  };
}

function readStoredFilter(
  storage: ProjectForgeCatalogStorage | undefined,
  page: ProjectActivityFilterPage,
): ProjectActivityFilterId[] | undefined {
  if (!storage) return undefined;
  return (
    parseStoredFilter(storage.getItem(projectActivityFilterStorageKey(page))) ??
    (page === "projects"
      ? parseStoredFilter(storage.getItem(PROJECT_ACTIVITY_FILTER_STORAGE_KEY))
      : undefined)
  );
}

function parseStoredFilter(
  serialized: string | null,
): ProjectActivityFilterId[] | undefined {
  if (serialized === null) return undefined;
  try {
    const parsed = JSON.parse(serialized) as {
      version?: unknown;
      value?: unknown;
    };
    if (parsed.version !== 1) return undefined;
    if (isProjectActivityFilterId(parsed.value)) {
      return normalizeProjectActivityFilters([parsed.value]);
    }
    return Array.isArray(parsed.value)
      ? normalizeProjectActivityFilters(parsed.value)
      : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredFilter(
  storage: ProjectForgeCatalogStorage | undefined,
  page: ProjectActivityFilterPage,
  value: readonly ProjectActivityFilterId[],
): void {
  if (!storage) return;
  try {
    storage.setItem(
      projectActivityFilterStorageKey(page),
      JSON.stringify({
        version: 1,
        value: normalizeProjectActivityFilters(value),
      }),
    );
  } catch {
    return;
  }
}

function discoverStorage(): ProjectForgeCatalogStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
