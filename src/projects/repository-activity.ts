import type { NostrEvent } from "../protocol/index.js";

import { buildProjectForgeActivity } from "./workspace.js";
import type {
  ProjectForgeActivityItem,
  ProjectForgeCatalog,
  ProjectForgeCommit,
  ProjectForgeCommitActivity,
  ProjectForgeRepository,
  ProjectForgeWorkItems,
} from "./model.js";
import { KIND_JJ_OPERATION } from "./work-item-filters.js";

export {
  buzzWorkItemFilters,
  pagedBuzzWorkItemFilters,
  KIND_JJ_OPERATION,
} from "./work-item-filters.js";

export function buildRepositoryActivity(
  catalog: ProjectForgeCatalog,
  workItems: ProjectForgeWorkItems,
  commits: readonly ProjectForgeCommitActivity[] = [],
): ProjectForgeActivityItem[] {
  return [
    ...buildProjectForgeActivity(catalog, workItems, commits),
    ...jjSyncActivityItems(workItems.events, catalog),
  ].sort(
    (left, right) =>
      right.createdAt - left.createdAt || left.id.localeCompare(right.id),
  );
}

export function repositoryCommitActivity(
  repository: ProjectForgeRepository | undefined,
  projectCoordinate: string | undefined,
  commits: readonly ProjectForgeCommit[],
  fallback: readonly ProjectForgeCommitActivity[],
): readonly ProjectForgeCommitActivity[] {
  if (!repository || !projectCoordinate || commits.length === 0) {
    return fallback;
  }
  return commits.map((commit) => ({
    projectCoordinate,
    repositoryCoordinate: repository.address.coordinate,
    commit,
  }));
}

export function repositoryVisibleActivity(
  activity: readonly ProjectForgeActivityItem[],
  repositories: readonly ProjectForgeRepository[],
  selectedRepository?: ProjectForgeRepository,
): ProjectForgeActivityItem[] {
  const hiddenAnchors = hiddenTaskAnchors(repositories);
  return activity.filter((item) => {
    if (item.kind === "project") return false;
    if (
      item.repositoryCoordinate &&
      hiddenAnchors.has(item.repositoryCoordinate)
    ) {
      return false;
    }
    if (!selectedRepository) return true;
    return item.repositoryCoordinate === selectedRepository.address.coordinate;
  });
}

export function projectVisibleActivity(
  activity: readonly ProjectForgeActivityItem[],
  project: {
    address: { coordinate: string };
    repositories: readonly { coordinate: string }[];
  },
  repositories: readonly ProjectForgeRepository[],
): ProjectForgeActivityItem[] {
  const hiddenAnchors = hiddenTaskAnchors(repositories);
  const members = new Set(
    project.repositories.map((reference) => reference.coordinate),
  );
  return activity.filter((item) => {
    if (item.projectCoordinate !== project.address.coordinate) return false;
    if (item.kind === "project") return true;
    if (
      item.repositoryCoordinate &&
      (hiddenAnchors.has(item.repositoryCoordinate) ||
        !members.has(item.repositoryCoordinate))
    ) {
      return false;
    }
    return true;
  });
}

function hiddenTaskAnchors(
  repositories: readonly ProjectForgeRepository[],
): Set<string> {
  return new Set(
    repositories
      .filter((repository) => repository.repositoryClass === "task-anchor")
      .map((repository) => repository.address.coordinate),
  );
}

export function jjSyncActivityItems(
  events: readonly NostrEvent[],
  catalog: ProjectForgeCatalog,
): ProjectForgeActivityItem[] {
  const items: ProjectForgeActivityItem[] = [];
  for (const event of events) {
    if (event.kind !== KIND_JJ_OPERATION) continue;
    const announcement = parseJjSyncAnnouncement(event.content);
    if (!announcement) continue;
    const repositoryCoordinate =
      event.tags.find((tag) => tag[0] === "a")?.[1] ??
      catalog.repositories.find((repository) =>
        event.tags.some(
          (tag) => tag[0] === "r" && tag[1] === announcement.scope_id,
        ),
      )?.address.coordinate;
    if (!repositoryCoordinate) continue;
    const project = catalog.projects.find((candidate) =>
      candidate.repositories.some(
        (reference) => reference.coordinate === repositoryCoordinate,
      ),
    );
    if (!project) continue;
    items.push({
      id: `jj-sync:${event.id}`,
      kind: "commit",
      createdAt:
        Math.floor(announcement.occurred_at_ms / 1_000) || event.created_at,
      actorPubkey: event.pubkey,
      action: "published a jj-sync operation in",
      title: announcement.operation_id,
      body: announcement.replica_id,
      detail: "jj-sync",
      projectCoordinate: project.address.coordinate,
      repositoryCoordinate,
    });
  }
  return items;
}

function parseJjSyncAnnouncement(content: string):
  | {
      scope_id: string;
      replica_id: string;
      operation_id: string;
      occurred_at_ms: number;
    }
  | undefined {
  try {
    const parsed = JSON.parse(content) as {
      schema?: unknown;
      scope_id?: unknown;
      replica_id?: unknown;
      operation_id?: unknown;
      occurred_at_ms?: unknown;
    };
    if (parsed.schema !== "jj-sync/operation") return undefined;
    if (
      typeof parsed.scope_id !== "string" ||
      typeof parsed.replica_id !== "string" ||
      typeof parsed.operation_id !== "string"
    ) {
      return undefined;
    }
    return {
      scope_id: parsed.scope_id,
      replica_id: parsed.replica_id,
      operation_id: parsed.operation_id,
      occurred_at_ms:
        typeof parsed.occurred_at_ms === "number" ? parsed.occurred_at_ms : 0,
    };
  } catch {
    return undefined;
  }
}
