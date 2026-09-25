import type { ProjectForgeSession } from "./data-source.js";
import {
  projectForgeBranchRefs,
  type ProjectForgeCommit,
  type ProjectForgeCommitsOptions,
  type ProjectForgeCommitsResponse,
} from "./model.js";

/** Empty advertised repositories have no HEAD to pass to the commits endpoint. */
export async function readRepositoryDefaultCommits(
  session: Pick<ProjectForgeSession, "loadCommits">,
  repository: string,
  signal?: AbortSignal,
): Promise<readonly ProjectForgeCommit[]> {
  return (await readRepositoryDefaultCommitPage(session, repository, signal))
    .commits;
}

export async function readRepositoryDefaultCommitPage(
  session: Pick<ProjectForgeSession, "loadCommits">,
  repository: string,
  signal?: AbortSignal,
  options: ProjectForgeCommitsOptions = {},
): Promise<ProjectForgeCommitsResponse> {
  if (!hasRepositoryRefs(session)) {
    return await session.loadCommits(repository, undefined, signal, options);
  }
  const refs = await session.loadRefs(repository, signal);
  signal?.throwIfAborted();
  const revision = refs.head?.sha || projectForgeBranchRefs(refs)[0]?.sha;
  if (!revision) return { ref: "", sha: "", commits: [], more: false };
  return await session.loadCommits(repository, revision, signal, options);
}

function hasRepositoryRefs(
  session: Pick<ProjectForgeSession, "loadCommits">,
): session is Pick<ProjectForgeSession, "loadRefs" | "loadCommits"> {
  return "loadRefs" in session && typeof session.loadRefs === "function";
}
