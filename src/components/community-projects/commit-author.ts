import { initials } from "../../community/materialize-shared.js";
import type { ProjectForgeCommit } from "../../projects/index.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";

export function commitAuthorName(commit: ProjectForgeCommit): string {
  return (
    commit.author?.trim() ||
    commit.author_name?.trim() ||
    commit.author_email?.trim() ||
    "Unknown author"
  );
}

export function commitAuthorMember(
  commit: ProjectForgeCommit,
): CommunityMemberModel {
  const name = commitAuthorName(commit);
  return {
    id: `git:${commit.author_email ?? commit.sha}`,
    name,
    handle: commit.author_email ?? name,
    initials: initials(name),
  };
}

export function commitDate(value: string | undefined): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
