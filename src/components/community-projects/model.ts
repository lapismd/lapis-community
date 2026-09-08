import type { RegistrySigner } from "../../auth/index.js";
import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  ProjectForgeBlobResponse,
  ProjectForgeActivityItem,
  ProjectForgeCommit,
  ProjectForgeCommitResponse,
  ProjectForgeDataSource,
  ProjectForgeDiffFile,
  ProjectForgeProject,
  ProjectForgePullRequestDiff,
  ProjectForgeRepository,
  ProjectForgeOverviewSurface,
  ProjectForgeSurface,
  ProjectForgeTreeResponse,
  ProjectTaskState,
  PullRequestState,
} from "../../projects/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export interface CommunityProjectsOptions {
  source: ProjectForgeDataSource;
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
}

export interface CommunityProjectsCreateRepository {
  name: string;
  identifier: string;
  description: string;
  mode: "hosted" | "external";
  cloneUrl: string;
  webUrl: string;
}

export interface CommunityProjectsCreateTask {
  repository: string | "project";
  title: string;
  content: string;
}

export interface CommunityProjectsCreatePullRequest {
  repository: string;
  title: string;
  content: string;
  commit: string;
  cloneUrl: string;
  branchName: string;
  targetBranch: string;
}

export interface CommunityProjectsDialogRequest {
  id: number;
  kind: "project" | "repository" | "task" | "review";
}

export interface CommunityProjectsProps {
  view: "directory" | ProjectForgeOverviewSurface | ProjectForgeSurface;
  projects: readonly ProjectForgeProject[];
  selectedProject?: ProjectForgeProject;
  repositories?: readonly ProjectForgeRepository[];
  activity?: readonly ProjectForgeActivityItem[];
  tasks?: readonly ProjectTaskState[];
  selectedTask?: ProjectTaskState;
  pullRequests?: readonly PullRequestState[];
  selectedPullRequest?: PullRequestState;
  commits?: readonly ProjectForgeCommit[];
  /** Active repository head shown beside commit rows, when available. */
  commitBranch?: string;
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
  members?: readonly CommunityMemberModel[];
  rooms?: readonly CommunityRoomModel[];
  communityEmojis?: readonly CommunityCustomEmoji[];
  currentMemberId?: string;
  loading?: boolean;
  error?: string;
  operation?: string;
  canCollaborate?: boolean;
  dialogRequest?: CommunityProjectsDialogRequest;
  showNavigation?: boolean;
  /** Render the pull-request title in this surface instead of an owning shell header. */
  showReviewHeader?: boolean;
  onSelectView?: (
    view: ProjectForgeOverviewSurface | ProjectForgeSurface,
  ) => void;
  onBack?: () => void;
  onSelectProject?: (project: ProjectForgeProject) => void;
  onSelectChannel?: (roomId: string) => void;
  onOpenProfile?: (member: CommunityMemberModel) => void;
  onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onCreateProject?: (input: CommunityProjectsCreateProject) => Promise<void>;
  onCreateRepository?: (
    input: CommunityProjectsCreateRepository,
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
  onSelectPullRequest?: (pullRequest: PullRequestState) => void;
  onClosePullRequest?: () => void;
  onApprovePullRequest?: (pullRequest: PullRequestState) => Promise<void>;
  onRequestChanges?: (pullRequest: PullRequestState) => Promise<void>;
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
  onSelectCommit?: (commit: ProjectForgeCommit) => void;
  onCloseCommit?: () => void;
  onSelectPath?: (path: string) => void;
  onRetry?: () => void;
}

export type CommunityProjectsDiffFile = ProjectForgeDiffFile & {
  patch: string;
};
