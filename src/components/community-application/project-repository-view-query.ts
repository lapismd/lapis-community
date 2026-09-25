import type {
  ProjectForgeCatalog,
  ProjectForgeCommit,
  ProjectForgeCommitActivity,
  ProjectForgeCommitResponse,
  ProjectForgeOverviewSurface,
  ProjectForgePullRequestDiff,
  ProjectForgeRef,
  ProjectForgeRepository,
  ProjectForgeRepositoryCapabilities,
  ProjectForgeRepositoryCapabilitiesByCoordinate,
  ProjectForgeSession,
  ProjectForgeSurface,
  ProjectForgeTreeResponse,
  OwnersDocument,
} from "../../projects/index.js";
import { loadProjectCommitActivity } from "../../projects/index.js";
import { readRepositoryDefaultCommits } from "../../projects/repository-default-history.js";
import { repositorySupportsBrowsing } from "./repository-browsing.js";
import { loadRepositorySource } from "./project-repository-view-source.js";

export interface ProjectRepositoryViewInput {
  catalog: ProjectForgeCatalog;
  session: ProjectForgeSession;
  identityAvailable: boolean;
  projectCoordinate?: string | undefined;
  repositoryCoordinate?: string | undefined;
  surface?: ProjectForgeSurface | undefined;
  overviewSurface: ProjectForgeOverviewSurface;
  pullRequestSurface?:
    | ProjectForgeSurface
    | ProjectForgeOverviewSurface
    | undefined;
  pullRequestId: string;
  selectedCommitSha?: string | undefined;
  filesRouteRevision?: string | undefined;
  selectedPath?: string | undefined;
  requestedRepositoryBranch: string;
  requestedRepositoryBranchOwner: string;
  inlineProjectFilesSheetOpen: boolean;
}

export interface ProjectRepositoryViewResult {
  capabilities: ProjectForgeRepositoryCapabilitiesByCoordinate;
  capabilityError: string;
  commitActivity: readonly ProjectForgeCommitActivity[];
  commits: readonly ProjectForgeCommit[];
  commitBranch: string;
  branches: readonly ProjectForgeRef[];
  revision: string;
  sourceRepositoryCoordinate: string;
  selectedCommitDetail: ProjectForgeCommitResponse | undefined;
  tree: ProjectForgeTreeResponse | undefined;
  owners: OwnersDocument | undefined;
  pullRequestDiff: ProjectForgePullRequestDiff | undefined;
  pullRequestDiffError: string;
  sourceError: string;
}

export function projectRepositoryViewQueryTarget(
  input: ProjectRepositoryViewInput,
) {
  return {
    repository: input.repositoryCoordinate ?? "project-overview",
    surface: input.surface ?? input.overviewSurface,
    revision: input.filesRouteRevision || input.requestedRepositoryBranch,
    path: input.selectedPath,
    commitSha: input.selectedCommitSha,
    pullRequestId: input.pullRequestId,
  };
}

export async function loadProjectRepositoryView(
  input: ProjectRepositoryViewInput,
  signal: AbortSignal,
): Promise<ProjectRepositoryViewResult> {
  const project = input.catalog.projects.find(
    (candidate) => candidate.address.coordinate === input.projectCoordinate,
  );
  const requestedRepository = input.catalog.repositories.find(
    (repository) =>
      repository.address.coordinate === input.repositoryCoordinate,
  );
  const projectsToLoad = project ? [project] : input.catalog.projects;
  const repositoryCoordinates = new Set(
    projectsToLoad.flatMap((candidate) =>
      candidate.repositories.map((reference) => reference.coordinate),
    ),
  );
  const repositories = requestedRepository
    ? [requestedRepository]
    : project
      ? input.catalog.repositories.filter((repository) =>
          repositoryCoordinates.has(repository.address.coordinate),
        )
      : input.catalog.repositories;
  const { capabilities, capabilityError } = await loadCapabilities(
    input.session,
    repositories,
    input.identityAvailable,
    signal,
  );
  const browsableRepositories = repositories.filter((repository) =>
    repositorySupportsBrowsing(
      repository,
      capabilities[repository.address.coordinate],
    ),
  );
  const commitActivity = await maybeLoadCommitActivity(
    input,
    browsableRepositories,
    project ? [project] : input.catalog.projects,
    signal,
  );
  const sourceRepository = requestedRepository
    ? browsableRepositories.find(
        (repository) =>
          repository.address.coordinate ===
          requestedRepository.address.coordinate,
      )
    : undefined;
  if (!sourceRepository) {
    return emptyRepositoryResult(capabilities, capabilityError, commitActivity);
  }
  return loadSourceRepositoryView(
    input,
    sourceRepository,
    capabilities,
    capabilityError,
    commitActivity,
    signal,
  );
}

async function loadCapabilities(
  session: ProjectForgeSession,
  repositories: readonly ProjectForgeRepository[],
  identityAvailable: boolean,
  signal: AbortSignal,
): Promise<{
  capabilities: Record<string, ProjectForgeRepositoryCapabilities>;
  capabilityError: string;
}> {
  const capabilities: Record<string, ProjectForgeRepositoryCapabilities> = {};
  const failures: unknown[] = [];
  if (identityAvailable) {
    await Promise.all(
      repositories
        .filter((repository) => repository.repositoryClass !== "task-anchor")
        .map(async (repository) => {
          try {
            capabilities[repository.address.coordinate] = (
              await session.loadCapabilities(
                repository.address.coordinate,
                signal,
              )
            ).capabilities;
          } catch (cause) {
            if (signal.aborted) throw cause;
            failures.push(cause);
          }
        }),
    );
  }
  return {
    capabilities,
    capabilityError:
      failures[0] === undefined
        ? ""
        : failureMessage(
            failures[0],
            "Repository capabilities could not be loaded",
          ),
  };
}

async function maybeLoadCommitActivity(
  input: ProjectRepositoryViewInput,
  repositories: readonly ProjectForgeRepository[],
  projects: ProjectForgeCatalog["projects"],
  signal: AbortSignal,
): Promise<readonly ProjectForgeCommitActivity[]> {
  if (
    input.repositoryCoordinate ||
    !(
      input.surface === undefined ||
      input.surface === "activity" ||
      input.surface === "commits" ||
      input.overviewSurface === "activity" ||
      input.overviewSurface === "repositories"
    )
  ) {
    return [];
  }
  return loadProjectCommitActivity(
    input.session,
    repositories,
    projects,
    signal,
  );
}

function emptyRepositoryResult(
  capabilities: ProjectForgeRepositoryCapabilitiesByCoordinate,
  capabilityError: string,
  commitActivity: readonly ProjectForgeCommitActivity[],
): ProjectRepositoryViewResult {
  return {
    capabilities,
    capabilityError,
    commitActivity,
    commits: [],
    commitBranch: "",
    branches: [],
    revision: "",
    sourceRepositoryCoordinate: "",
    selectedCommitDetail: undefined,
    tree: undefined,
    owners: undefined,
    pullRequestDiff: undefined,
    pullRequestDiffError: "",
    sourceError: capabilityError,
  };
}

async function loadSourceRepositoryView(
  input: ProjectRepositoryViewInput,
  sourceRepository: ProjectForgeRepository,
  capabilities: ProjectForgeRepositoryCapabilitiesByCoordinate,
  capabilityError: string,
  commitActivity: readonly ProjectForgeCommitActivity[],
  signal: AbortSignal,
): Promise<ProjectRepositoryViewResult> {
  const repository = sourceRepository.address.coordinate;
  const result = emptyRepositoryResult(
    capabilities,
    capabilityError,
    commitActivity,
  );
  result.sourceRepositoryCoordinate = repository;
  if (
    input.surface === undefined ||
    input.surface === "overview" ||
    input.surface === "commits" ||
    input.surface === "activity"
  ) {
    result.commits = await readRepositoryDefaultCommits(
      input.session,
      repository,
      signal,
    ).catch((cause: unknown) => {
      if (signal.aborted) throw cause;
      result.sourceError =
        input.surface === "commits"
          ? failureMessage(cause, "The commit history could not be loaded")
          : "";
      return [];
    });
  }
  if (input.surface === "commits" && input.selectedCommitSha) {
    try {
      result.selectedCommitDetail = await input.session.loadCommit(
        repository,
        input.selectedCommitSha,
        signal,
      );
    } catch (cause) {
      if (signal.aborted) throw cause;
      result.sourceError = failureMessage(
        cause,
        "The commit diff could not be loaded",
      );
    }
  }
  await loadRepositorySource(input, result, repository, signal);
  if (input.pullRequestSurface === "reviews" && input.pullRequestId) {
    try {
      result.pullRequestDiff = await input.session.loadPullRequestDiff(
        input.pullRequestId,
        { signal },
      );
    } catch (cause) {
      if (signal.aborted) throw cause;
      result.pullRequestDiffError = failureMessage(
        cause,
        "The pull request diff could not be loaded",
      );
    }
  }
  return result;
}

function failureMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
