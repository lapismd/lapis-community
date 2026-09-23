export function abbreviateGitCommit(value?: string): string {
  const commit = value?.trim().toLowerCase() ?? "";
  return /^[0-9a-f]{7,}$/u.test(commit) ? commit.slice(0, 7) : "";
}

export function pullRequestSourceLabel(input: {
  branchName?: string;
  currentCommit?: string;
}): string {
  return (
    input.branchName?.trim() ||
    abbreviateGitCommit(input.currentCommit) ||
    "commit"
  );
}

export function pullRequestTargetLabel(input: {
  targetBranch?: string;
}): string {
  return input.targetBranch?.trim() || "default";
}

export function pullRequestBranchLabel(input: {
  branchName?: string;
  targetBranch?: string;
  currentCommit?: string;
}): string {
  return `${pullRequestSourceLabel(input)} → ${pullRequestTargetLabel(input)}`;
}
