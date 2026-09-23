import { projectForgeBranchName, type ProjectForgeRef } from "./model.js";
import { partitionProjectForgeBranchRefs } from "./repository-refs.js";

export function workspaceBranchForCommit(
  commit: string,
  branches: readonly ProjectForgeRef[],
  excludeName?: string,
): string | undefined {
  const sha = commit.trim().toLowerCase();
  if (!sha) return undefined;
  const excluded = excludeName?.trim();
  const match = partitionProjectForgeBranchRefs(branches).branches.find(
    (ref) =>
      ref.sha.toLowerCase() === sha &&
      projectForgeBranchName(ref.name) !== excluded,
  );
  return match ? projectForgeBranchName(match.name) : undefined;
}
