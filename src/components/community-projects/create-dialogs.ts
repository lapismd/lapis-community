import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  ProjectForgeGitHubConnection,
  ProjectForgeGitHubRepository,
  ProjectForgeProject,
  ProjectForgeRef,
  ProjectForgeRepository,
} from "../../projects/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import type {
  CommunityProjectsCreateProject,
  CommunityProjectsCreatePullRequest,
  CommunityProjectsCreateRepository,
  CommunityProjectsCreateTask,
} from "./model.js";

export interface CommunityProjectsCreateDialogsProps {
  projectOpen?: boolean | undefined;
  projectMode?: "create" | "edit" | undefined;
  projectDraft?:
    | (CommunityProjectsCreateProject & {
        visibility: "public" | "private";
      })
    | undefined;
  channelOpen?: boolean | undefined;
  channelMode?: "home" | "attach" | undefined;
  channelPending?: string | undefined;
  channelTarget?: ProjectForgeProject | undefined;
  channelProjects?: readonly ProjectForgeProject[] | undefined;
  channelOptions?: readonly CommunityRoomModel[] | undefined;
  projectChannelIds: ReadonlySet<string>;
  repositoryOpen?: boolean | undefined;
  repositoryDraft?: CommunityProjectsCreateRepository | undefined;
  repositoryCommandOpen?: boolean | undefined;
  repositoryCommandStep?: "repository" | "project" | undefined;
  repositoryCommandCoordinate?: string | undefined;
  attachableRepositories?: readonly ProjectForgeRepository[] | undefined;
  repositoryAttachmentProjects?: readonly ProjectForgeProject[] | undefined;
  githubOpen?: boolean | undefined;
  githubStep?: "connection" | "repository" | undefined;
  githubConnection?: ProjectForgeGitHubConnection | undefined;
  githubConnections?: readonly ProjectForgeGitHubConnection[] | undefined;
  githubRepositories?: readonly ProjectForgeGitHubRepository[] | undefined;
  githubLoading?: boolean | undefined;
  githubError?: string | undefined;
  githubManagerOpen?: boolean | undefined;
  githubManagerFormOpen?: boolean | undefined;
  githubDraft?:
    | {
        appId: string;
        installationId: string;
        credentialRef: string;
        webhookSecretRef: string;
        bridgeCredentialRef: string;
        bridgePubkey: string;
      }
    | undefined;
  githubManagerConnection?: ProjectForgeGitHubConnection | undefined;
  githubManagerConnections?:
    | readonly ProjectForgeGitHubConnection[]
    | undefined;
  githubManagerLoading?: boolean | undefined;
  githubManagerError?: string | undefined;
  githubManagerOperation?: string | undefined;
  taskOpen?: boolean | undefined;
  taskDraft?: CommunityProjectsCreateTask | undefined;
  taskProject?: ProjectForgeProject | undefined;
  taskRepositories?: readonly ProjectForgeRepository[] | undefined;
  taskHasScope?: boolean | undefined;
  pullRequestOpen?: boolean | undefined;
  pullRequestDraft?: CommunityProjectsCreatePullRequest | undefined;
  pullRequestBranches?: readonly ProjectForgeRef[] | undefined;
  pullRequestCompareBranches?: readonly ProjectForgeRef[] | undefined;
  pullRequestRefsLoading?: boolean | undefined;
  pullRequestRefsError?: string | undefined;
  selectedProject?: ProjectForgeProject | undefined;
  selectedRepository?: ProjectForgeRepository | undefined;
  projects?: readonly ProjectForgeProject[] | undefined;
  reviewableRepositories?: readonly ProjectForgeRepository[] | undefined;
  availableChannels?: readonly CommunityRoomModel[] | undefined;
  members?: readonly CommunityMemberModel[] | undefined;
  rooms?: readonly CommunityRoomModel[] | undefined;
  communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
  currentMemberId?: string | undefined;
  busy?: boolean | undefined;
  operation?: string | undefined;
  localError?: string | undefined;
  canManageForge?: boolean | undefined;
  onResetError: () => void;
  onOpenChannelPicker: () => void;
  onSelectChannelProject: (coordinate: string) => void;
  onSelectProjectChannel: (channel: CommunityRoomModel) => void;
  onSubmitProject: (event: SubmitEvent) => void;
  onSelectRepositoryProject: (value: string) => void;
  onSubmitRepository: (event: SubmitEvent) => void;
  onSelectExistingRepository: (repository: ProjectForgeRepository) => void;
  onRepositoryPickerBack: () => void;
  onAttachExistingRepository: (
    projectCoordinate: string,
    repositoryCoordinate: string,
  ) => void;
  onSelectGitHubConnection: (connection: ProjectForgeGitHubConnection) => void;
  onGitHubPickerBack: () => void;
  onAttachGitHubRepository: (repository: ProjectForgeGitHubRepository) => void;
  onOpenGitHubManager: () => void;
  onSubmitGitHubConnection: (event: SubmitEvent) => void;
  onRefreshGitHubConnections: () => void;
  onRevalidateGitHubConnection: (
    connection: ProjectForgeGitHubConnection,
  ) => void;
  onOpenGitHubConnectionForm: (
    connection?: ProjectForgeGitHubConnection,
  ) => void;
  onGitHubManagerBack: () => void;
  onSelectTaskProject: (value: string) => void;
  onSelectTaskRepository: (value: string) => void;
  onSubmitTask: (event: SubmitEvent) => void;
  onSelectPullRequestRepository: (value: string) => void;
  onSubmitPullRequest: (event: SubmitEvent) => void;
}
