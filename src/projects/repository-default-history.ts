import type { ProjectForgeSession } from "./data-source.js";
import { projectForgeBranchRefs, type ProjectForgeCommit } from "./model.js";

/** Empty advertised repositories have no HEAD to pass to the commits endpoint. */
export async function readRepositoryDefaultCommits(
  session: Pick<ProjectForgeSession, "loadCommits">,
  repository: string,
  signal?: AbortSignal,
): Promise<readonly ProjectForgeCommit[]> {
  if (!hasRepositoryRefs(session)) {
    return (await session.loadCommits(repository, undefined, signal)).commits;
  }
  const refs = await session.loadRefs(repository, signal);
  signal?.throwIfAborted();
  const revision = refs.head?.sha || projectForgeBranchRefs(refs)[0]?.sha;
  if (!revision) return [];
  const response = await session.loadCommits(repository, revision, signal);
  return response.commits;
}

function hasRepositoryRefs(
  session: Pick<ProjectForgeSession, "loadCommits">,
): session is Pick<ProjectForgeSession, "loadRefs" | "loadCommits"> {
  return "loadRefs" in session && typeof session.loadRefs === "function";
}
