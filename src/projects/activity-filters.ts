import type { ProjectForgeCatalogStorage } from "./catalog-store.js";
import {
  PROJECT_FORGE_KINDS,
  type ProjectForgeActivityItem,
  type ProjectForgeActivityKind,
} from "./model.js";
import { KIND_JJ_OPERATION } from "./work-item-filters.js";

export const PROJECT_ACTIVITY_FILTER_DEFAULT = "all" as const;
export const PROJECT_ACTIVITY_WEEK_SECONDS = 604_800;
export const PROJECT_ACTIVITY_FILTER_STORAGE_KEY =
  "lapismd.community.projects.activity-filter.v1";

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

export interface ProjectActivityFilterStore {
  load(): ProjectActivityFilterId;
  save(value: ProjectActivityFilterId): void;
}

export function isProjectActivityFilterId(
  value: unknown,
): value is ProjectActivityFilterId {
  return PROJECT_ACTIVITY_FILTERS.some((option) => option.id === value);
}

export function filterProjectActivity(
  activity: readonly ProjectForgeActivityItem[],
  filter: ProjectActivityFilterId,
): ProjectForgeActivityItem[] {
  if (filter === PROJECT_ACTIVITY_FILTER_DEFAULT) return [...activity];
  return activity.filter((item) => item.kind === filter);
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

export function createBrowserProjectActivityFilterStore(options: {
  storage?: ProjectForgeCatalogStorage | undefined;
} = {}): ProjectActivityFilterStore {
  const storage = options.storage ?? discoverStorage();
  return {
    load() {
      const value = readStoredFilter(storage);
      return value ?? PROJECT_ACTIVITY_FILTER_DEFAULT;
    },
    save(value) {
      writeStoredFilter(storage, value);
    },
  };
}

function readStoredFilter(
  storage: ProjectForgeCatalogStorage | undefined,
): ProjectActivityFilterId | undefined {
  if (!storage) return undefined;
  try {
    const serialized = storage.getItem(PROJECT_ACTIVITY_FILTER_STORAGE_KEY);
    if (serialized === null) return undefined;
    const parsed = JSON.parse(serialized) as {
      version?: unknown;
      value?: unknown;
    };
    return parsed.version === 1 && isProjectActivityFilterId(parsed.value)
      ? parsed.value
      : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredFilter(
  storage: ProjectForgeCatalogStorage | undefined,
  value: ProjectActivityFilterId,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      PROJECT_ACTIVITY_FILTER_STORAGE_KEY,
      JSON.stringify({ version: 1, value }),
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
