import type { FileListingFile } from "@lapismd/design-core/diff";

import type { ProjectForgeCommitResponse } from "./model.js";
import { splitProjectForgePatch } from "./patch.js";

export const REPOSITORY_LOG_FILES_UNAVAILABLE =
  "Changed files are unavailable for this revision.";

export function repositoryLogFilesError(cause: unknown): string {
  const message =
    cause instanceof Error ? cause.message : cause ? String(cause) : "";
  if (message.includes("git_object_not_found")) return "";
  return message || REPOSITORY_LOG_FILES_UNAVAILABLE;
}

export function repositoryLogChangedFiles(
  detail: ProjectForgeCommitResponse | undefined,
): FileListingFile[] {
  const parsed = detail?.patch ? splitProjectForgePatch(detail.patch) : [];
  const stats = detail?.stats ?? [];
  if (stats.length === 0) {
    return parsed.map((file) => ({
      path: file.path,
      additions: file.additions,
      deletions: file.deletions,
    }));
  }
  return stats.map((stat) => ({
    path: stat.path,
    additions: stat.additions,
    deletions: stat.deletions,
  }));
}

export function repositoryLogFilePatch(
  detail: ProjectForgeCommitResponse | undefined,
  path: string | null | undefined,
): string | undefined {
  if (!detail?.patch || !path) return undefined;
  return splitProjectForgePatch(detail.patch).find(
    (file) => file.path === path || file.old_path === path,
  )?.patch;
}
