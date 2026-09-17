import type {
  RepositoryLogDevice,
  RepositoryLogGraph,
  RepositoryLogRevision,
} from "./repository-log.js";

const ANCESTOR_BUDGET = 500;

export type RepositoryLogViewSeeds = {
  pinned: boolean;
  heads: readonly string[];
  bookmarks: readonly string[];
  workspaces: readonly string[];
};

export function seedsFromViewBody(
  body: {
    head_commit_ids?: unknown;
    local_bookmarks?: unknown;
    workspaces?: unknown;
  },
  pinned: boolean,
): RepositoryLogViewSeeds {
  return {
    pinned,
    heads: stringList(body.head_commit_ids),
    bookmarks: arrayOf(body.local_bookmarks)
      .map((item) => resolvedCommitId(item.target))
      .filter((id): id is string => Boolean(id)),
    workspaces: arrayOf(body.workspaces)
      .map((item) => asString(item.working_copy_commit_id))
      .filter((id): id is string => Boolean(id)),
  };
}

export function projectRepositoryLog(
  parsed: readonly RepositoryLogRevision[],
  views: readonly {
    event: { created_at: number };
    body: {
      view_id?: unknown;
      head_commit_ids?: unknown;
      local_bookmarks?: unknown;
      workspaces?: unknown;
    };
  }[],
  contextViewId: string | undefined,
  collectDevices: (visible: Set<string>) => RepositoryLogDevice[],
  order: (revisions: RepositoryLogRevision[]) => RepositoryLogRevision[],
): RepositoryLogGraph {
  const pinned = pinView(views, contextViewId);
  const viewSeeds = views.map((view) =>
    seedsFromViewBody(view.body, view === pinned),
  );
  const collapsed = collapseRepositoryLogRevisions(parsed);
  const aliases = repositoryLogCommitAliases(parsed, collapsed);
  const remap = (id: string) => aliases.get(id) ?? id;
  const seeds = collectSeeds(viewSeeds, parsed).map(remap);
  const visible = omitAbandonedEmpties(
    ancestorsOf(collapsed, seeds),
    new Set([...pinnedKeepEmpty(viewSeeds)].map(remap)),
  );
  if (visible.length === 0) return { revisions: [], devices: [] };
  const kept = new Set(visible.map((item) => item.eventId));
  return {
    revisions: order(visible),
    devices: remapRepositoryLogDevices(
      collectDevices(new Set([...kept, ...aliases.keys()])),
      aliases,
      kept,
    ),
  };
}

export function collapseRepositoryLogRevisions(
  revisions: readonly RepositoryLogRevision[],
): RepositoryLogRevision[] {
  const byId = new Map(
    revisions.map((revision) => [revision.eventId, revision]),
  );
  const kept = new Map<string, RepositoryLogRevision>();
  for (const revision of revisions) {
    const key = revision.changeId || revision.eventId;
    const current = kept.get(key);
    if (!current || newerRevision(revision, current)) kept.set(key, revision);
  }
  const visible = [...kept.values()];
  const keptIds = new Set(visible.map((revision) => revision.eventId));
  const aliases = repositoryLogCommitAliases(revisions, visible);
  return visible.map((revision) => ({
    ...revision,
    parents: remapParents(revision, byId, keptIds, aliases),
  }));
}

export function repositoryLogCommitAliases(
  revisions: readonly RepositoryLogRevision[],
  kept: readonly RepositoryLogRevision[],
): Map<string, string> {
  const keptByChange = new Map(
    kept
      .filter((revision) => revision.changeId)
      .map((revision) => [revision.changeId, revision.eventId]),
  );
  const aliases = new Map<string, string>();
  for (const revision of revisions) {
    if (kept.some((item) => item.eventId === revision.eventId)) continue;
    const target = revision.changeId
      ? keptByChange.get(revision.changeId)
      : undefined;
    if (target) aliases.set(revision.eventId, target);
  }
  return aliases;
}

function pinView<
  T extends { event: { created_at: number }; body: { view_id?: unknown } },
>(views: readonly T[], contextViewId: string | undefined): T | undefined {
  if (contextViewId) {
    const matched = views.find((view) => view.body.view_id === contextViewId);
    if (matched) return matched;
  }
  return views.reduce<T | undefined>((newest, view) => {
    if (!newest || view.event.created_at >= newest.event.created_at)
      return view;
    return newest;
  }, undefined);
}

function collectSeeds(
  views: readonly RepositoryLogViewSeeds[],
  parsed: readonly RepositoryLogRevision[],
): string[] {
  const empty = new Set(
    parsed
      .filter((revision) => revision.empty && revision.parents.length > 0)
      .map((revision) => revision.eventId),
  );
  const seeds = new Set<string>();
  for (const view of views) {
    for (const id of [...view.heads, ...view.bookmarks]) {
      if (view.pinned || !empty.has(id)) seeds.add(id);
    }
    if (view.pinned) {
      for (const id of view.workspaces) seeds.add(id);
    }
  }
  return [...seeds];
}

function pinnedKeepEmpty(
  views: readonly RepositoryLogViewSeeds[],
): Set<string> {
  const keep = new Set<string>();
  for (const view of views) {
    if (!view.pinned) continue;
    for (const id of [...view.heads, ...view.bookmarks, ...view.workspaces]) {
      keep.add(id);
    }
  }
  return keep;
}

function ancestorsOf(
  revisions: readonly RepositoryLogRevision[],
  seeds: readonly string[],
): RepositoryLogRevision[] {
  const byId = new Map(
    revisions.map((revision) => [revision.eventId, revision]),
  );
  const seen = new Set<string>();
  const visible: RepositoryLogRevision[] = [];
  const queue = seeds.filter((id) => byId.has(id));
  while (queue.length > 0 && visible.length < ANCESTOR_BUDGET) {
    const id = queue.shift();
    if (!id || !seen.add(id)) continue;
    const revision = byId.get(id);
    if (!revision) continue;
    visible.push(revision);
    queue.push(...revision.parents);
  }
  return visible;
}

function omitAbandonedEmpties(
  revisions: readonly RepositoryLogRevision[],
  keepEmpty: Set<string>,
): RepositoryLogRevision[] {
  const drop = new Set(
    revisions
      .filter(
        (revision) =>
          revision.empty &&
          revision.parents.length > 0 &&
          !keepEmpty.has(revision.eventId),
      )
      .map((revision) => revision.eventId),
  );
  if (drop.size === 0) return [...revisions];
  const byId = new Map(
    revisions.map((revision) => [revision.eventId, revision]),
  );
  return revisions
    .filter((revision) => !drop.has(revision.eventId))
    .map((revision) => ({
      ...revision,
      parents: skipDroppedParents(revision.parents, drop, byId),
    }));
}

function skipDroppedParents(
  parents: readonly string[],
  drop: Set<string>,
  byId: Map<string, RepositoryLogRevision>,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const queue = [...parents];
  while (queue.length > 0) {
    const parentId = queue.shift();
    if (!parentId || !seen.add(parentId)) continue;
    if (drop.has(parentId)) {
      const dropped = byId.get(parentId);
      if (dropped) queue.push(...dropped.parents);
      continue;
    }
    result.push(parentId);
  }
  return result;
}

function remapRepositoryLogDevices(
  devices: readonly RepositoryLogDevice[],
  aliases: Map<string, string>,
  kept: Set<string>,
): RepositoryLogDevice[] {
  return devices
    .map((device) => ({
      ...device,
      revisionEventId:
        aliases.get(device.revisionEventId) ?? device.revisionEventId,
    }))
    .filter((device) => kept.has(device.revisionEventId));
}

function remapParents(
  revision: RepositoryLogRevision,
  byId: Map<string, RepositoryLogRevision>,
  keptIds: Set<string>,
  aliases: Map<string, string>,
): string[] {
  const parents: string[] = [];
  const seen = new Set<string>();
  const queue = [...revision.parents];
  while (queue.length > 0) {
    const parentId = queue.shift();
    if (!parentId || parentId === revision.eventId || seen.has(parentId)) {
      continue;
    }
    seen.add(parentId);
    if (keptIds.has(parentId)) {
      parents.push(parentId);
      continue;
    }
    const mapped = aliases.get(parentId);
    if (mapped && mapped !== revision.eventId && keptIds.has(mapped)) {
      parents.push(mapped);
      continue;
    }
    const dropped = byId.get(parentId);
    if (dropped) queue.push(...dropped.parents);
  }
  return parents;
}

function newerRevision(
  left: RepositoryLogRevision,
  right: RepositoryLogRevision,
): boolean {
  return (
    left.createdAt > right.createdAt ||
    (left.createdAt === right.createdAt && left.eventId > right.eventId)
  );
}

function resolvedCommitId(target: unknown): string | undefined {
  if (!isRecord(target) || target.state !== "resolved") return undefined;
  return asString(target.commit_id);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
