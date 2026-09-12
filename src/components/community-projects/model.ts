import type { RegistrySigner } from "../../auth/index.js";
import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  ProjectForgeBlobResponse,
  ProjectForgeActivityItem,
  ProjectForgeCommit,
  ProjectForgeCommitResponse,
  ProjectForgeDataSource,
  ProjectForgeCatalogStore,
  ProjectForgeDiffFile,
  ProjectForgeGitHubConnection,
  ProjectForgeGitHubConnectionInput,
  ProjectForgeGitHubConnectionsResponse,
  ProjectForgeGitHubRepositoriesResponse,
  ProjectForgeGitHubRepository,
  ProjectForgeProject,
  ProjectForgePullRequestDiff,
  ProjectForgeRepository,
  ProjectForgeRepositoryCapabilitiesByCoordinate,
  ProjectForgeRef,
  ProjectReviewPreferenceScope,
  ProjectReviewPreferenceStore,
  ProjectForgeRefsResponse,
  ProjectForgeOverviewSurface,
  ProjectForgeSurface,
  ProjectForgeTreeResponse,
  ProjectTaskState,
  PullRequestComment,
  PullRequestReviewKind,
  PullRequestState,
} from "../../projects/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export interface CommunityProjectsOptions {
  source: ProjectForgeDataSource;
  /** Defaults to a relay- and community-scoped browser catalog cache. */
  catalogStore?: ProjectForgeCatalogStore;
  /** Defaults to the active Community relay. */
  relayUrl?: string;
  httpBaseUrl?: string | URL;
  identity?: RegistrySigner;
  /** Optional exact NIP-29 group scope for the initial directory query. */
  channelId?: string;
}

export interface CommunityProjectsCreateProject {
  name: string;
  identifier: string;
  description: string;
  channelId: string;
  listing: "listed" | "unlisted";
}

export interface CommunityProjectsUpdateProject {
  name: string;
  description: string;
  channelId: string;
  listing: "listed" | "unlisted";
  /** Replaces direct project-channel attachments when provided. */
  relatedChannelIds?: readonly string[];
}

export interface CommunityProjectsCreateRepository {
  project: string;
  channelId: string;
  name: string;
  identifier: string;
  description: string;
  mode: "hosted" | "external";
  cloneUrl: string;
  webUrl: string;
}

export interface CommunityProjectsCreateTask {
  project: string;
  repository: string | "project";
  category: "issue" | "change-request" | "improvement";
  title: string;
  content: string;
}

export interface CommunityProjectsCreatePullRequest {
  repository: string;
  title: string;
  content: string;
  branchName: string;
  targetBranch: string;
}

export interface CommunityProjectsDialogRequest {
  id: number;
  kind:
    | "project"
    | "edit-project"
    | "repository"
    | "select-repository"
    | "connect-github"
    | "manage-github"
    | "task"
    | "review";
  projectCoordinate?: string;
}

export interface CommunityProjectsProps {
  view: "directory" | ProjectForgeOverviewSurface | ProjectForgeSurface;
  projects: readonly ProjectForgeProject[];
  selectedProject?: ProjectForgeProject;
  repositories?: readonly ProjectForgeRepository[];
  /** Repository announcements available for attachment outside the current project scope. */
  repositoryOptions?: readonly ProjectForgeRepository[];
  selectedRepository?: ProjectForgeRepository;
  /** Relay-resolved operational capabilities keyed by repository coordinate. */
  repositoryCapabilities?: ProjectForgeRepositoryCapabilitiesByCoordinate;
  activity?: readonly ProjectForgeActivityItem[];
  tasks?: readonly ProjectTaskState[];
  selectedTask?: ProjectTaskState;
  pullRequests?: readonly PullRequestState[];
  selectedPullRequest?: PullRequestState;
  commits?: readonly ProjectForgeCommit[];
  /** Active repository head shown beside commit rows, when available. */
  commitBranch?: string;
  /** Selectable provider-neutral branch refs for the repository browser. */
  repositoryBranches?: readonly ProjectForgeRef[];
  /** Branch whose tree is currently loaded in the repository browser. */
  selectedRepositoryBranch?: string;
  selectedCommit?: ProjectForgeCommit;
  selectedCommitDetail?: ProjectForgeCommitResponse;
  /** Source-read failure shared by overview, file, and commit surfaces. */
  sourceError?: string;
  /** @deprecated Use `sourceError`; retained for existing commit consumers. */
  selectedCommitError?: string;
  tree?: ProjectForgeTreeResponse;
  selectedPath?: string;
  blob?: ProjectForgeBlobResponse;
  pullRequestDiff?: ProjectForgePullRequestDiff;
  /** Relay gateway failure while loading the selected pull request diff. */
  pullRequestDiffError?: string;
  members?: readonly CommunityMemberModel[];
  rooms?: readonly CommunityRoomModel[];
  communityEmojis?: readonly CommunityCustomEmoji[];
  currentMemberId?: string;
  /** Browser persistence for signed-in review preferences. */
  reviewPreferenceStore?: ProjectReviewPreferenceStore;
  /** Relay, community, and signed-in member scope for persisted review state. */
  reviewPreferenceScope?: ProjectReviewPreferenceScope;
  loading?: boolean;
  /** Epoch milliseconds for a verified catalog restored before live refresh. */
  cachedCatalogAt?: number;
  error?: string;
  operation?: string;
  canCollaborate?: boolean;
  /** Relay-admin capability for provider connection management. */
  canManageForge?: boolean;
  dialogRequest?: CommunityProjectsDialogRequest;
  showNavigation?: boolean;
  /** Keep project dialogs mounted without rendering the project workspace. */
  showContent?: boolean;
  /** Render the pull-request title in this surface instead of an owning shell header. */
  showReviewHeader?: boolean;
  onSelectView?: (
    view: ProjectForgeOverviewSurface | ProjectForgeSurface,
  ) => void;
  onBack?: () => void;
  onSelectProject?: (project: ProjectForgeProject) => void;
  onSelectRepository?: (repository: ProjectForgeRepository) => void;
  onSelectChannel?: (roomId: string) => void;
  onOpenProfile?: (member: CommunityMemberModel) => void;
  onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onCreateProject?: (input: CommunityProjectsCreateProject) => Promise<void>;
  onUpdateProject?: (
    project: ProjectForgeProject,
    input: CommunityProjectsUpdateProject,
  ) => Promise<void>;
  onCreateRepository?: (
    input: CommunityProjectsCreateRepository,
  ) => Promise<void>;
  onAttachRepository?: (
    projectCoordinate: string,
    repositoryCoordinate: string,
  ) => Promise<void>;
  onLoadGitHubConnections?: () => Promise<ProjectForgeGitHubConnectionsResponse>;
  onCreateGitHubConnection?: (
    input: ProjectForgeGitHubConnectionInput,
  ) => Promise<ProjectForgeGitHubConnection>;
  onUpdateGitHubConnection?: (
    connectionId: string,
    input: ProjectForgeGitHubConnectionInput,
  ) => Promise<ProjectForgeGitHubConnection>;
  onRevalidateGitHubConnection?: (
    connectionId: string,
  ) => Promise<ProjectForgeGitHubConnection>;
  onLoadGitHubRepositories?: (
    connectionId: string,
  ) => Promise<ProjectForgeGitHubRepositoriesResponse>;
  onAttachGitHubRepository?: (
    repository: ProjectForgeRepository,
    connection: ProjectForgeGitHubConnection,
    providerRepository: ProjectForgeGitHubRepository,
  ) => Promise<void>;
  onCreateTask?: (input: CommunityProjectsCreateTask) => Promise<void>;
  onSelectTask?: (task: ProjectTaskState) => void;
  onCloseTask?: () => void;
  onUpdateTaskAssignment?: (
    task: ProjectTaskState,
    assignee: string,
    assigned: boolean,
  ) => Promise<void>;
  onManageTaskAssignments?: (task: ProjectTaskState) => void;
  onAddTaskComment?: (task: ProjectTaskState, content: string) => Promise<void>;
  onUpdateTaskLifecycle?: (
    task: ProjectTaskState,
    lifecycle: "open" | "closed",
  ) => Promise<void>;
  onCreatePullRequest?: (
    input: CommunityProjectsCreatePullRequest,
  ) => Promise<void>;
  onLoadRepositoryRefs?: (
    repositoryCoordinate: string,
  ) => Promise<ProjectForgeRefsResponse>;
  onSelectPullRequest?: (pullRequest: PullRequestState) => void;
  onClosePullRequest?: () => void;
  /** @deprecated Use `onSubmitPullRequestReview`. */
  onApprovePullRequest?: (pullRequest: PullRequestState) => Promise<void>;
  /** @deprecated Use `onSubmitPullRequestReview`. */
  onRequestChanges?: (pullRequest: PullRequestState) => Promise<void>;
  onSubmitPullRequestReview?: (
    pullRequest: PullRequestState,
    review: { decision: PullRequestReviewKind; content: string },
  ) => Promise<void>;
  onMergePullRequest?: (pullRequest: PullRequestState) => Promise<void>;
  onUpdatePullRequestLifecycle?: (
    pullRequest: PullRequestState,
    lifecycle: "open" | "closed" | "draft",
  ) => Promise<void>;
  onAddPullRequestComment?: (
    pullRequest: PullRequestState,
    content: string,
  ) => Promise<void>;
  onAddInlineComment?: (
    pullRequest: PullRequestState,
    input: { path: string; side: "old" | "new"; line: number; content: string },
  ) => Promise<void>;
  onTogglePullRequestCommentReaction?: (
    pullRequest: PullRequestState,
    comment: PullRequestComment,
    emoji: string,
  ) => Promise<void>;
  onSelectCommit?: (commit: ProjectForgeCommit) => void;
  onCloseCommit?: () => void;
  onSelectRepositoryBranch?: (branch: string) => void;
  onLoadRepositoryPathCommit?: (
    path: string,
    signal?: AbortSignal,
  ) => Promise<ProjectForgeCommit | undefined>;
  onSelectPath?: (path: string) => void;
  onRetry?: () => void | Promise<void>;
}

export type CommunityProjectsDiffFile = ProjectForgeDiffFile & {
  patch: string;
};
