import type { ProjectForgeTreeResponse } from "../../projects/index.js";
import {
  loadOwnersFromBlob,
  loadProjectRepositoryFileTree,
  projectForgeBranchRefs,
} from "../../projects/index.js";
import { repositorySurfaceLoadsRefs } from "../../projects/repository-surface-refs.js";

import { projectFilesSurfaceLoadsTree } from "./project-files-selection.js";
import { repositoryViewRevision } from "./project-route-files.js";
import type { ProjectRepositoryReadSession } from "./project-repository-read-query.js";
import type {
  ProjectRepositoryViewInput,
  ProjectRepositoryViewResult,
} from "./project-repository-view-query.js";

export async function loadRepositorySource(
  input: ProjectRepositoryViewInput,
  result: ProjectRepositoryViewResult,
  repository: string,
  signal: AbortSignal,
  session: ProjectRepositoryReadSession = input.session,
): Promise<void> {
  if (!repositorySurfaceLoadsRefs(input.surface)) return;
  try {
    const refs = await session.loadRefs(repository, signal);
    const branches = projectForgeBranchRefs(refs);
    const view = repositoryViewRevision({
      surface: input.surface,
      routeRevision: input.filesRouteRevision,
      requestedBranch: input.requestedRepositoryBranch,
      requestedOwnerMatches:
        input.requestedRepositoryBranchOwner === repository,
      branches,
      ...(refs.head?.name ? { headName: refs.head.name } : {}),
      ...(refs.head?.sha ? { headSha: refs.head.sha } : {}),
    });
    result.branches = branches;
    result.commitBranch = view.branch;
    result.revision = view.revision;
    if (
      view.revision &&
      projectFilesSurfaceLoadsTree(input.surface, {
        filesRouteRevision: input.filesRouteRevision,
        inlineProjectFilesSheetOpen: input.inlineProjectFilesSheetOpen,
      })
    ) {
      result.tree = await loadTree(
        input,
        repository,
        view.revision,
        signal,
        session,
      );
      if (input.surface === "files" && result.tree.commit) {
        result.commits = [result.tree.commit];
      }
      if (input.surface === undefined || input.surface === "overview") {
        result.owners = await loadOwnersFromBlob(
          () =>
            session.loadBlob(repository, view.revision, "OWNERS.md", signal),
          signal,
        );
      }
    }
  } catch (cause) {
    if (signal.aborted) throw cause;
    result.commitBranch = "";
    result.branches = [];
    result.revision = "";
    result.tree = undefined;
    result.owners = undefined;
    result.sourceError = failureMessage(
      cause,
      "The repository source could not be loaded",
    );
  }
}

async function loadTree(
  input: ProjectRepositoryViewInput,
  repository: string,
  revision: string,
  signal: AbortSignal,
  session: ProjectRepositoryReadSession,
): Promise<ProjectForgeTreeResponse> {
  let tree =
    input.surface === "files"
      ? await loadProjectRepositoryFileTree(
          session,
          repository,
          revision,
          signal,
        )
      : await session.loadTree(repository, revision, "", signal);
  if (input.surface === "files") {
    const commits = await session.loadCommits(repository, revision, signal, {
      limit: 1,
    });
    if (commits.commits[0]) tree = { ...tree, commit: commits.commits[0] };
  }
  if (
    (input.surface === undefined || input.surface === "overview") &&
    !tree.readme?.trim()
  ) {
    const readme = tree.entries.find(
      (entry) =>
        entry.type === "blob" &&
        /^readme(?:\.(?:md|markdown|mdown|rst|txt))?$/iu.test(entry.name),
    );
    if (readme) {
      try {
        const blob = await session.loadBlob(
          repository,
          revision,
          readme.path ?? readme.name,
          signal,
        );
        if (!blob.binary && !blob.too_large && blob.contents) {
          tree = { ...tree, readme: blob.contents };
        }
      } catch (cause) {
        if (signal.aborted) throw cause;
      }
    }
  }
  return tree;
}

function failureMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
