<script lang="ts">
  import CommunityProjectsChannelPickerDialog from "./CommunityProjectsChannelPickerDialog.svelte";
  import CommunityProjectsGitHubManagerDialog from "./CommunityProjectsGitHubManagerDialog.svelte";
  import CommunityProjectsGitHubPickerDialog from "./CommunityProjectsGitHubPickerDialog.svelte";
  import CommunityProjectsProjectDialog from "./CommunityProjectsProjectDialog.svelte";
  import CommunityProjectsPullRequestCreateDialog from "./CommunityProjectsPullRequestCreateDialog.svelte";
  import CommunityProjectsRepositoryDialog from "./CommunityProjectsRepositoryDialog.svelte";
  import CommunityProjectsRepositoryPickerDialog from "./CommunityProjectsRepositoryPickerDialog.svelte";
  import CommunityProjectsTaskDialog from "./CommunityProjectsTaskDialog.svelte";
  import type { CommunityProjectsCreateDialogsProps } from "./create-dialogs.js";

  let {
    projectOpen = $bindable(false),
    projectMode = "create",
    projectDraft = $bindable(),
    channelOpen = $bindable(false),
    channelMode = "home",
    channelPending = "",
    channelTarget,
    channelProjects = [],
    channelOptions = [],
    projectChannelIds,
    repositoryOpen = $bindable(false),
    repositoryDraft = $bindable(),
    repositoryCommandOpen = $bindable(false),
    repositoryCommandStep = $bindable("repository"),
    repositoryCommandCoordinate = $bindable(""),
    attachableRepositories = [],
    repositoryAttachmentProjects = [],
    githubOpen = $bindable(false),
    githubStep = $bindable("connection"),
    githubConnection = $bindable(),
    githubConnections = [],
    githubRepositories = [],
    githubLoading = false,
    githubError = "",
    githubManagerOpen = $bindable(false),
    githubManagerFormOpen = $bindable(false),
    githubDraft = $bindable(),
    githubManagerConnection,
    githubManagerLoading = false,
    githubManagerError = "",
    githubManagerOperation = "",
    taskOpen = $bindable(false),
    taskDraft = $bindable(),
    taskProject,
    taskRepositories = [],
    taskHasScope = false,
    pullRequestOpen = $bindable(false),
    pullRequestDraft = $bindable(),
    pullRequestBranches = [],
    pullRequestCompareBranches = [],
    pullRequestRefsLoading = false,
    pullRequestRefsError = "",
    selectedProject,
    selectedRepository,
    projects = [],
    reviewableRepositories = [],
    availableChannels = [],
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    busy = false,
    operation = "",
    localError = "",
    canManageForge = false,
    onResetError,
    onOpenChannelPicker,
    onSelectChannelProject,
    onSelectProjectChannel,
    onSubmitProject,
    onSelectRepositoryProject,
    onSubmitRepository,
    onSelectExistingRepository,
    onRepositoryPickerBack,
    onAttachExistingRepository,
    onSelectGitHubConnection,
    onGitHubPickerBack,
    onAttachGitHubRepository,
    onOpenGitHubManager,
    onSubmitGitHubConnection,
    onRefreshGitHubConnections,
    onRevalidateGitHubConnection,
    onOpenGitHubConnectionForm,
    onGitHubManagerBack,
    onSelectTaskProject,
    onSelectTaskRepository,
    onSubmitTask,
    onSelectPullRequestRepository,
    onSubmitPullRequest,
    githubManagerConnections = [],
  }: CommunityProjectsCreateDialogsProps = $props();
</script>

<CommunityProjectsProjectDialog
  bind:open={projectOpen}
  mode={projectMode}
  bind:draft={projectDraft}
  channels={availableChannels}
  channelCommandOpen={channelOpen}
  {busy}
  {operation}
  {localError}
  {members}
  {rooms}
  {communityEmojis}
  {currentMemberId}
  onOpenChange={onResetError}
  {onOpenChannelPicker}
  onSubmit={onSubmitProject}
/>
<CommunityProjectsChannelPickerDialog
  bind:open={channelOpen}
  mode={channelMode}
  pending={channelPending}
  target={channelTarget}
  projects={channelProjects}
  channels={channelOptions}
  {projectChannelIds}
  onSelectProject={onSelectChannelProject}
  onSelectChannel={onSelectProjectChannel}
/>
<CommunityProjectsRepositoryDialog
  bind:open={repositoryOpen}
  bind:draft={repositoryDraft}
  {selectedProject}
  {projects}
  channels={availableChannels}
  {busy}
  {operation}
  {localError}
  {members}
  {rooms}
  {communityEmojis}
  {currentMemberId}
  onOpenChange={onResetError}
  onSelectProject={onSelectRepositoryProject}
  onSubmit={onSubmitRepository}
/>
<CommunityProjectsRepositoryPickerDialog
  bind:open={repositoryCommandOpen}
  bind:step={repositoryCommandStep}
  bind:coordinate={repositoryCommandCoordinate}
  repositories={attachableRepositories}
  projects={repositoryAttachmentProjects}
  {localError}
  onSelectRepository={onSelectExistingRepository}
  onBack={onRepositoryPickerBack}
  onSelectProject={onAttachExistingRepository}
/>
<CommunityProjectsGitHubPickerDialog
  bind:open={githubOpen}
  bind:step={githubStep}
  bind:connection={githubConnection}
  {selectedRepository}
  connections={githubConnections}
  repositories={githubRepositories}
  loading={githubLoading}
  error={githubError}
  canManage={canManageForge}
  onSelectConnection={onSelectGitHubConnection}
  onBack={onGitHubPickerBack}
  onSelectRepository={onAttachGitHubRepository}
  onManage={onOpenGitHubManager}
/>
<CommunityProjectsGitHubManagerDialog
  bind:open={githubManagerOpen}
  bind:formOpen={githubManagerFormOpen}
  bind:draft={githubDraft}
  connections={githubManagerConnections}
  editing={githubManagerConnection}
  loading={githubManagerLoading}
  error={githubManagerError}
  operation={githubManagerOperation}
  onSubmit={onSubmitGitHubConnection}
  onRefresh={onRefreshGitHubConnections}
  onRevalidate={onRevalidateGitHubConnection}
  onOpenForm={onOpenGitHubConnectionForm}
  onBack={onGitHubManagerBack}
/>
<CommunityProjectsTaskDialog
  bind:open={taskOpen}
  bind:draft={taskDraft}
  {selectedProject}
  {selectedRepository}
  {projects}
  repositories={taskRepositories}
  {taskProject}
  hasScope={taskHasScope}
  {busy}
  {operation}
  {localError}
  {members}
  {rooms}
  {communityEmojis}
  {currentMemberId}
  onOpenChange={onResetError}
  onSelectProject={onSelectTaskProject}
  onSelectRepository={onSelectTaskRepository}
  onSubmit={onSubmitTask}
/>
<CommunityProjectsPullRequestCreateDialog
  bind:open={pullRequestOpen}
  bind:draft={pullRequestDraft}
  repositories={reviewableRepositories}
  branches={pullRequestBranches}
  compareBranches={pullRequestCompareBranches}
  refsLoading={pullRequestRefsLoading}
  refsError={pullRequestRefsError}
  {busy}
  {operation}
  {localError}
  {members}
  {rooms}
  {communityEmojis}
  {currentMemberId}
  onOpenChange={onResetError}
  onSelectRepository={onSelectPullRequestRepository}
  onSubmit={onSubmitPullRequest}
/>
