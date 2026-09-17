import type {
  RepositoryLogDevice,
  RepositoryLogReason,
  RepositoryLogRevision,
} from "./repository-log.js";

export const REPOSITORY_LOG_ROW_HEIGHT = 76;
export const REPOSITORY_LOG_LANE_WIDTH = 16;
export const REPOSITORY_LOG_NODE_RADIUS = 5;
export const REPOSITORY_LOG_LEFT_PAD = 12;

export const REPOSITORY_LOG_LANE_COLORS = [
  "var(--ui-log-lane-1, #2563eb)",
  "var(--ui-log-lane-2, #16a34a)",
  "var(--ui-log-lane-3, #d97706)",
  "var(--ui-log-lane-4, #dc2626)",
  "var(--ui-log-lane-5, #7c3aed)",
  "var(--ui-log-lane-6, #0891b2)",
  "var(--ui-log-lane-7, #db2777)",
  "var(--ui-log-lane-8, #65a30d)",
] as const;

export type RepositoryLogGraphLane = {
  hash: string;
  color: string;
};

export type RepositoryLogGraphRow = {
  revision: RepositoryLogRevision;
  commitLane: number;
  lanes: RepositoryLogGraphLane[];
  mergeFromLanes: number[];
  convergingLanes: number[];
  splitFromLane: number | null;
  commitStartsLane: boolean;
  isFirst: boolean;
  isTip: boolean;
  deviceAliases: string[];
};

export function repositoryLogReasonLabel(reason: RepositoryLogReason): string {
  return reason === "merge" ? "Merge" : "Snapshot";
}

export function repositoryLogRowLabel(revision: RepositoryLogRevision): string {
  return `${revision.message} ${revision.eventId.slice(0, 8)} ${repositoryLogReasonLabel(revision.reason)}`;
}

export function formatRepositoryLogTimestamp(createdAt: number): string {
  return new Date(createdAt * 1000).toLocaleString();
}

export function tipRevisionIds(
  revisions: readonly RepositoryLogRevision[],
): string[] {
  const referenced = new Set<string>();
  for (const revision of revisions) {
    for (const parent of revision.parents) referenced.add(parent);
  }
  return revisions
    .filter((revision) => !referenced.has(revision.eventId))
    .map((revision) => revision.eventId);
}

export function repositoryLogLaneX(lane: number): number {
  return (
    REPOSITORY_LOG_LEFT_PAD +
    lane * REPOSITORY_LOG_LANE_WIDTH +
    REPOSITORY_LOG_LANE_WIDTH / 2
  );
}

export function repositoryLogLaneStem(
  row: RepositoryLogGraphRow,
  lane: number,
  rowHeight = REPOSITORY_LOG_ROW_HEIGHT,
): { y1: number; y2: number } {
  const center = rowHeight / 2;
  const isSplitCommitLane =
    row.splitFromLane != null && lane === row.commitLane;
  const starts =
    row.commitStartsLane && row.commitLane === lane && !isSplitCommitLane;
  const converge = row.convergingLanes.includes(lane);
  return {
    y1: row.isFirst || starts ? center : 0,
    y2: converge || isSplitCommitLane ? center : rowHeight,
  };
}

export function repositoryLogContentLeft(row: RepositoryLogGraphRow): number {
  const rightmost = Math.max(
    row.lanes.length - 1,
    row.mergeFromLanes.length ? Math.max(...row.mergeFromLanes) : 0,
    row.commitLane,
  );
  return (
    REPOSITORY_LOG_LEFT_PAD +
    (rightmost + 1) * REPOSITORY_LOG_LANE_WIDTH +
    REPOSITORY_LOG_LANE_WIDTH
  );
}

export function repositoryLogSvgWidth(rows: RepositoryLogGraphRow[]): number {
  let maxLanes = 1;
  for (const row of rows) {
    maxLanes = Math.max(
      maxLanes,
      row.lanes.length,
      row.mergeFromLanes.length ? Math.max(...row.mergeFromLanes) + 1 : 0,
      row.commitLane + 1,
    );
  }
  return (
    REPOSITORY_LOG_LEFT_PAD +
    maxLanes * REPOSITORY_LOG_LANE_WIDTH +
    REPOSITORY_LOG_LANE_WIDTH
  );
}

export function buildRepositoryLogGraph(
  revisions: readonly RepositoryLogRevision[],
  devices: readonly RepositoryLogDevice[] = [],
): RepositoryLogGraphRow[] {
  const lanes: RepositoryLogGraphLane[] = [];
  let colorIndex = 0;
  const rows: RepositoryLogGraphRow[] = [];
  const tips = new Set(tipRevisionIds(revisions));
  const aliasesByHead = new Map<string, string[]>();
  for (const device of devices) {
    const aliases = aliasesByHead.get(device.revisionEventId) ?? [];
    aliases.push(device.alias);
    aliasesByHead.set(device.revisionEventId, aliases);
  }

  for (let commitIndex = 0; commitIndex < revisions.length; commitIndex += 1) {
    const revision = revisions[commitIndex];
    if (!revision) continue;
    let commitLane = lanes.findIndex((lane) => lane.hash === revision.eventId);
    let commitStartsLane = false;
    if (commitLane === -1) {
      commitStartsLane = true;
      commitLane = lanes.length;
      lanes.push({
        hash: revision.eventId,
        color:
          REPOSITORY_LOG_LANE_COLORS[
            colorIndex++ % REPOSITORY_LOG_LANE_COLORS.length
          ] ?? REPOSITORY_LOG_LANE_COLORS[0],
      });
    }

    const currentLanes = lanes.map((lane) => ({ ...lane }));
    const convergingLanes = currentLanes.flatMap((lane, index) =>
      lane.hash === revision.eventId && index !== commitLane ? [index] : [],
    );
    const firstParent = revision.parents[0];
    const otherParents = revision.parents.slice(1);
    const firstParentLane = firstParent
      ? currentLanes.findIndex((lane) => lane.hash === firstParent)
      : -1;
    const splitFromLane =
      commitLane === currentLanes.length - 1 &&
      firstParentLane !== -1 &&
      firstParentLane !== commitLane
        ? firstParentLane
        : null;
    const currentColor =
      lanes[commitLane]?.color ?? REPOSITORY_LOG_LANE_COLORS[0];
    if (firstParent) {
      lanes[commitLane] = { hash: firstParent, color: currentColor };
    } else {
      lanes.splice(commitLane, 1);
    }

    const mergeFromLanes: number[] = [];
    for (const parent of otherParents) {
      const existing = lanes.findIndex((lane) => lane.hash === parent);
      if (existing !== -1) {
        mergeFromLanes.push(existing);
        continue;
      }
      mergeFromLanes.push(lanes.length);
      lanes.push({
        hash: parent,
        color:
          REPOSITORY_LOG_LANE_COLORS[
            colorIndex++ % REPOSITORY_LOG_LANE_COLORS.length
          ] ?? REPOSITORY_LOG_LANE_COLORS[0],
      });
    }

    const seen = new Set<string>();
    for (let index = 0; index < lanes.length; ) {
      const hash = lanes[index]?.hash;
      if (!hash || seen.has(hash)) {
        lanes.splice(index, 1);
        continue;
      }
      seen.add(hash);
      index += 1;
    }

    rows.push({
      revision,
      commitLane,
      lanes: currentLanes,
      mergeFromLanes,
      convergingLanes,
      splitFromLane,
      commitStartsLane,
      isFirst: commitIndex === 0,
      isTip: tips.has(revision.eventId),
      deviceAliases: aliasesByHead.get(revision.eventId) ?? [],
    });
  }

  return rows;
}
