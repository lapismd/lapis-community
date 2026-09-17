import type { ProjectForgeSession } from "./data-source.js";
import type {
  ProjectForgeCommit,
  ProjectForgeCommitResponse,
} from "./model.js";

export async function readRepositoryPathCommit(
  session: ProjectForgeSession | undefined,
  repository: string | undefined,
  revision: string | undefined,
  path: string,
  signal?: AbortSignal,
): Promise<ProjectForgeCommit | undefined> {
  if (!session || !repository || !revision) return undefined;
  const response = await session.loadCommits(repository, revision, signal, {
    path,
    limit: 1,
  });
  return response.commits[0];
}

export async function readRepositoryCommit(
  session: ProjectForgeSession | undefined,
  repository: string | undefined,
  sha: string,
  signal?: AbortSignal,
): Promise<ProjectForgeCommitResponse> {
  if (!session || !repository) {
    throw new Error("Repository source is not ready");
  }
  return await session.loadCommit(repository, sha, signal);
}
