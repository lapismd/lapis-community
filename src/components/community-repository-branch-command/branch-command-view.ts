import type { ProjectForgeRef } from "../../projects/model.js";
import {
  partitionProjectForgeBranchRefs,
  projectForgeBranchKind,
  projectForgeDefaultBranchName,
} from "../../projects/repository-refs.js";

export function branchCommandPartition(
  branches: readonly ProjectForgeRef[],
  branch: string,
): {
  branches: readonly ProjectForgeRef[];
  sync: readonly ProjectForgeRef[];
} {
  const groups = partitionProjectForgeBranchRefs(branches);
  if (branches.length > 0 || !branch) return groups;
  const fallback = [{ name: branch, sha: "" }];
  return projectForgeBranchKind(branch) === "sync"
    ? { branches: groups.branches, sync: fallback }
    : { branches: fallback, sync: groups.sync };
}

export function branchCommandCopy(tab: string): {
  emptyLabel: string;
  searchLabel: string;
  groupHeading: string;
} {
  const sync = tab === "sync";
  return {
    emptyLabel: sync ? "No matching sync branches" : "No matching branches",
    searchLabel: sync ? "Find a sync branch..." : "Find a branch...",
    groupHeading: sync ? "Sync" : "Branches",
  };
}

export function branchCommandDefaultName(
  branches: readonly ProjectForgeRef[],
): string | undefined {
  return projectForgeDefaultBranchName(branches);
}

export function branchCommandLabel(
  branches: readonly ProjectForgeRef[],
  branch: string,
): string {
  if (!branch || branches.some((item) => item.name === branch)) return branch;
  const tips = branches.filter((item) => item.sha === branch);
  const preferred =
    tips.find(
      (item) => item.name === projectForgeDefaultBranchName(branches),
    ) ?? tips[0];
  return preferred?.name ?? branch;
}
