import type { RepositoryLogGraph } from "./repository-log.js";

export const REPOSITORY_LOG_PAGE_SIZE = 40;

export function takeRepositoryLogPage(
  graph: RepositoryLogGraph,
  visible: number,
): RepositoryLogGraph {
  const revisions = graph.revisions.slice(
    0,
    Math.max(0, Math.min(visible, graph.revisions.length)),
  );
  const ids = new Set(revisions.map((item) => item.eventId));
  return {
    revisions,
    devices: graph.devices.filter((device) => ids.has(device.revisionEventId)),
  };
}

export function nextRepositoryLogVisible(
  visible: number,
  total: number,
): number {
  if (visible >= total) return total;
  return Math.min(total, visible + REPOSITORY_LOG_PAGE_SIZE);
}
