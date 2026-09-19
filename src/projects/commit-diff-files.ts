import type { ProjectForgeCommitResponse } from "./model.js";
import { splitProjectForgePatch } from "./patch.js";

export function commitDiffFiles(detail?: ProjectForgeCommitResponse) {
  const parsed = detail?.patch ? splitProjectForgePatch(detail.patch) : [];
  const byPath = new Map(parsed.map((file) => [file.path, file]));
  const stats = detail?.stats ?? [];
  if (stats.length === 0) return parsed;
  const fromStats = stats.map((stat) => {
    const file = byPath.get(stat.path);
    byPath.delete(stat.path);
    return {
      path: stat.path,
      ...(stat.old_path ? { old_path: stat.old_path } : {}),
      status: file?.status ?? "modified",
      additions: stat.additions,
      deletions: stat.deletions,
      ...(stat.binary || file?.binary ? { binary: true } : {}),
      patch: file?.patch ?? "",
    };
  });
  return [...fromStats, ...byPath.values()];
}
