<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import {
    expect,
    fireEvent,
    fn,
    userEvent,
    waitFor,
    within,
  } from "storybook/test";

  import CommunityProjectsStoryHarness from "./CommunityProjectsStoryHarness.svelte";
  import {
    buildRepositoryActivity,
    createBrowserProjectReviewPreferenceStore,
    type ProjectForgeGitHubConnectionInput,
    type PullRequestState,
  } from "../../projects/index.js";
  import {
    createProjectStoryFixture,
    projectStoryAuthor,
    projectStoryOwner,
    projectStoryRepositoryCoordinate,
  } from "./story-fixtures.js";

  const fixture = createProjectStoryFixture();
  const reviewRequestEvent = {
    ...fixture.pullRequest.root,
    id: "7".repeat(64),
    kind: 1,
    created_at: fixture.pullRequest.createdAt + 5,
    content: "@maintainer requested a review from @reviewer",
    tags: [
      ["e", fixture.pullRequest.root.id, "", "root"],
      ["a", fixture.pullRequest.repository.coordinate],
      ["t", "review-request"],
      ["external-provider", "github"],
      ["external-author", "maintainer"],
      ["external-reviewer", "reviewer"],
    ],
  };
  const mergedEvent = {
    ...fixture.pullRequest.root,
    id: "8".repeat(64),
    kind: 1_631,
    created_at: fixture.pullRequest.updatedAt + 5,
    content: "",
    tags: [
      ["e", fixture.pullRequest.root.id, "", "root"],
      ["a", fixture.pullRequest.repository.coordinate],
      ["merge-commit", "e".repeat(40)],
      ["r", "e".repeat(40)],
      ["external-provider", "github"],
    ],
  };
  const mergedPullRequest: PullRequestState = {
    ...fixture.pullRequest,
    lifecycle: "merged",
    statusEvent: mergedEvent,
    mergeCommit: "e".repeat(40),
    mergeReferences: ["e".repeat(40)],
    lifecycleEvents: [
      {
        event: mergedEvent,
        lifecycle: "merged",
        mergeCommit: "e".repeat(40),
        mergeReferences: ["e".repeat(40)],
      },
    ],
    comments: [
      {
        event: reviewRequestEvent,
        encoding: "buzz-kind-1",
        commit: "d".repeat(40),
        isInlineComment: false,
        isReviewRequest: true,
        isTrustedReviewRequest: true,
        reviewerPubkeys: [],
        isTrustedDecision: false,
        reactions: [],
      },
      ...fixture.pullRequest.comments,
    ],
    updatedAt: mergedEvent.created_at,
  };
  const closedPullRequest: PullRequestState = {
    ...fixture.pullRequest,
    root: {
      ...fixture.pullRequest.root,
      id: "9".repeat(64),
      created_at: fixture.pullRequest.createdAt + 1,
    },
    title: "Close superseded review",
    lifecycle: "closed",
    mergeCommit: "",
    mergeReferences: [],
    lifecycleEvents: [],
  };
  const githubRepository = {
    ...fixture.repository,
    description: "GitHub-backed browser and desktop client.",
    cloneUrls: ["https://github.com/lapismd/community-client.git"],
    webUrls: ["https://github.com/lapismd/community-client"],
    repositoryClass: "external" as const,
  };
  const githubRepositoryCapabilities = {
    [projectStoryRepositoryCoordinate]: {
      git_authority_backend: "github",
      content_backend: "github",
      git_backend: "github",
      collaboration_backend: "github",
      clone: {
        available: true,
        url: "https://github.com/lapismd/community-client.git",
        auth: "provider" as const,
        provider: "github",
      },
      smart_http: { read: false, write: false },
      browse: true,
      compare: true,
      ref_events: true,
      provision: false,
      import: false,
      issues: false,
      pull_requests: false,
      reviews: false,
      merge: false,
      mirror: false,
      ci: false,
      capability_limits: {
        maximum_blob_bytes: 100_000_000,
        maximum_changed_files: 300,
        maximum_tree_entries: 1_000,
        may_truncate_compare: true,
        may_truncate_tree: true,
      },
    },
  };
  const githubMergeCapabilities = {
    [projectStoryRepositoryCoordinate]: {
      ...githubRepositoryCapabilities[projectStoryRepositoryCoordinate],
      merge: true,
    },
  };
  const mineRepositoryCoordinate = `30617:${projectStoryAuthor}:community-tools`;
  const mineRepository = {
    ...fixture.repository,
    event: {
      ...fixture.repository.event,
      id: "8".repeat(64),
      pubkey: projectStoryAuthor,
      created_at: 1_700_000_015,
    },
    address: {
      kind: 30_617,
      owner: projectStoryAuthor,
      identifier: "community-tools",
      coordinate: mineRepositoryCoordinate,
    },
    name: "community-tools",
    description: "Contributor-owned project utilities.",
  };
  const otherTask = {
    ...fixture.workItems.tasks[0],
    root: {
      ...fixture.workItems.tasks[0]!.root,
      id: "9".repeat(64),
      pubkey: projectStoryOwner,
      created_at: 1_700_000_025,
    },
    title: "Document the hosted repository flow",
    content: "Keep the repository onboarding path concise.",
    assignees: [projectStoryOwner],
    activity: [],
    createdAt: 1_700_000_025,
    updatedAt: 1_700_000_025,
  };
  const groupedTask = {
    ...fixture.workItems.tasks[0]!,
    assignees: [projectStoryAuthor, projectStoryOwner],
  };
  const repositoryActivity = [
    {
      id: "commit:community-client:1",
      kind: "commit" as const,
      createdAt: 1_700_000_050,
      actorPubkey: projectStoryAuthor,
      action: "pushed a commit to",
      title: "Align repository groups",
      body: "",
      projectCoordinate: fixture.project.address.coordinate,
      repositoryCoordinate: projectStoryRepositoryCoordinate,
    },
    {
      id: "commit:community-client:2",
      kind: "commit" as const,
      createdAt: 1_700_000_060,
      actorPubkey: projectStoryAuthor,
      action: "pushed a commit to",
      title: "Segment repository activity",
      body: "",
      projectCoordinate: fixture.project.address.coordinate,
      repositoryCoordinate: projectStoryRepositoryCoordinate,
    },
  ];
  const onSelectProject = fn();
  const onSelectChannel = fn();
  const onSelectView = fn();
  const onOpenProfile = fn();
  const onMessageMember = fn();
  const onWaveMember = fn();
  const onUpdateProjectSettings = fn(async () => undefined);
  const onRemoveProjectChannel = fn(async () => undefined);
  const onUpdateTaskLifecycle = fn(async () => undefined);
  const onUpdateTaskAssignment = fn(async () => undefined);
  const onManageTaskAssignments = fn();
  const onAddTaskComment = fn(async () => undefined);
  const onSelectTask = fn();
  const onCloseTask = fn();
  const onCloseCommit = fn();
  const onSelectPath = fn();
  const onSelectRepositoryBranch = fn();
  const onAddPullRequestComment = fn(async () => undefined);
  const onAddInlineComment = fn(async () => undefined);
  const onSubmitPullRequestReview = fn(async () => undefined);
  const onTogglePullRequestCommentReaction = fn(async () => undefined);
  const onMergePullRequest = fn(async () => undefined);
  const onUpdatePullRequestLifecycle = fn(async () => undefined);
  const reviewPreferenceValues = new Map<string, string>();
  const reviewPreferenceStore = createBrowserProjectReviewPreferenceStore({
    storage: {
      getItem: (key) => reviewPreferenceValues.get(key) ?? null,
      setItem: (key, value) => reviewPreferenceValues.set(key, value),
      removeItem: (key) => reviewPreferenceValues.delete(key),
    },
  });
  const reviewPreferenceScope = {
    relayUrl: "wss://relay.example.com",
    communityId: "community",
    memberId: projectStoryAuthor,
  };
  const githubConnection = {
    id: "ghc-lapis",
    provider: "github" as const,
    host: "github.com" as const,
    installation_id: 99,
    account_id: "7",
    account_login: "lapismd",
    bridge_pubkey: "2".repeat(64),
    status: "active",
  };
  const githubErroredConnection = {
    ...githubConnection,
    id: "ghc-lapis-error",
    installation_id: 100,
    account_login: "lapismd-broken",
    status: "error",
    detail: "github_installation_unavailable",
    updated_at: "2026-09-09T12:00:00Z",
  };
  const githubProviderRepository = {
    id: 42,
    full_name: "lapismd/community-client",
    name: "community-client",
    default_branch: "main",
    clone_url: "https://github.com/lapismd/community-client.git",
    html_url: "https://github.com/lapismd/community-client",
    private: false,
    archived: false,
    disabled: false,
    owner: { id: 7, login: "lapismd" },
  };
  const onLoadGitHubConnections = fn(async () => ({
    connections: [githubConnection],
  }));
  const onLoadManagedGitHubConnections = fn(async () => ({
    connections: [githubConnection, githubErroredConnection],
  }));
  const onCreateGitHubConnection = fn(
    async (input: ProjectForgeGitHubConnectionInput) => ({
      ...githubConnection,
      id: "ghc-created",
      installation_id: input.installationId,
      bridge_pubkey: input.bridgePubkey,
    }),
  );
  const onUpdateGitHubConnection = fn(
    async (connectionId: string, input: ProjectForgeGitHubConnectionInput) => ({
      ...githubConnection,
      id: connectionId,
      installation_id: input.installationId,
      bridge_pubkey: input.bridgePubkey,
    }),
  );
  const onRevalidateGitHubConnection = fn(async (connectionId: string) => ({
    ...githubConnection,
    id: connectionId,
    installation_id: 100,
    account_login: "lapismd-broken",
  }));
  const onLoadGitHubRepositories = fn(async () => ({
    repositories: [githubProviderRepository],
  }));
  const onAttachGitHubRepository = fn(async () => undefined);
  const hostedCommit = {
    sha: "d".repeat(40),
    subject: "Add project file and diff views",
    body: "Use the public Design Core diff primitives.",
    author: "Noor Patel",
    author_email: "noor@example.test",
    commit_date: "2026-09-08T09:30:00Z",
  };
  const onLoadRepositoryPathCommit = fn(async (path: string) => ({
    ...hostedCommit,
    subject: `Update ${path}`,
  }));
  const onSelectCommit = fn();
  const hostedCommitDetail = {
    commit: hostedCommit,
    stats: [
      { path: "README.md", additions: 1, deletions: 0 },
      { path: "src/projects.ts", additions: 3, deletions: 1 },
    ],
    patch: `diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
 # Community Client
+
+Projects use relay-hosted source browsing.
diff --git a/src/projects.ts b/src/projects.ts
index 3333333..4444444 100644
--- a/src/projects.ts
+++ b/src/projects.ts
@@ -1,3 +1,5 @@
-export const projectViews = ["overview"];
+export const projectViews = ["overview", "files", "commits"];
+export const hostedSource = true;
+export type ProjectView = (typeof projectViews)[number];`,
  };

  const consumerSource = `<script lang="ts">
  import { CommunityProjects } from "@lapismd/lapis-community/components";
<\/script>

<CommunityProjects
  view="reviews"
  {projects}
  {selectedProject}
  {repositories}
  {pullRequests}
  {selectedPullRequest}
  {pullRequestDiff}
  canCollaborate
  onAddInlineComment={publishInlineComment}
/>`;

  const { Story } = defineMeta({
    title: "Community/Projects/Project Collaboration",
    component: CommunityProjectsStoryHarness,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "The Nostr-native project directory and task, review, capability-backed file, commit, and people surfaces used by the Community application shell.",
        },
      },
    },
    args: {
      projects: fixture.catalog.projects,
      selectedProject: fixture.project,
      repositories: fixture.catalog.repositories,
      tasks: fixture.workItems.tasks,
      pullRequests: fixture.workItems.pullRequests,
      commits: [hostedCommit],
      members: fixture.members,
      rooms: fixture.rooms,
      currentMemberId: projectStoryAuthor,
      canCollaborate: true,
      onOpenProfile,
      onMessageMember,
      onWaveMember,
    },
  });
</script>

<Story
  name="Activity workspace"
  args={{
    view: "activity",
    selectedProject: undefined,
    repositories: fixture.catalog.repositories,
    activity: buildRepositoryActivity(fixture.catalog, {
      ...fixture.workItems,
      pullRequests: [mergedPullRequest],
    }),
    onSelectProject,
    onSelectView,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
  }}
  play={async ({ canvas, canvasElement }) => {
    const projectsBody = canvas.getByRole("main", {
      name: "Projects",
    });
    const projectsScrollArea = projectsBody.querySelector(
      '[data-ui-component="scroll-area"][data-ui-part="scroll-area"]',
    );
    await expect(projectsBody).toHaveAttribute("data-layout", "scroll");
    await expect(projectsScrollArea).not.toBeNull();
    await expect(
      canvas.getByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    const projectsWorkspace = canvas.getByLabelText("Projects workspace");
    await expect(getComputedStyle(projectsWorkspace).overflowY).not.toBe(
      "auto",
    );
    const actorAvatar = canvas.getAllByRole("button", {
      name: "View Maya Chen's profile",
    })[0]!;
    await expect(actorAvatar).toHaveAttribute("aria-haspopup", "dialog");
    actorAvatar.click();
    await expect(onOpenProfile).toHaveBeenCalledWith(fixture.members[0]);
    const repositoryActivity = canvas.getByRole("button", {
      name: /^community-client Hosted browser and desktop client\./u,
    });
    await expect(
      repositoryActivity.querySelector(".lucide-folder-git-2"),
    ).not.toBeNull();
    const reviewCommentActivity = canvas.getByRole("button", {
      name: /Add project file and diff views The responsive file layout looks good\./u,
    });
    await expect(reviewCommentActivity).toBeVisible();
    await expect(reviewCommentActivity).not.toHaveTextContent(
      "lapis:story-review-comment",
    );
    const reviewCommentTitle = reviewCommentActivity.querySelector(
      ".community-projects__activity-title",
    );
    const reviewCommentBody = within(reviewCommentActivity).getByText(
      "The responsive file layout looks good.",
    );
    await expect(reviewCommentBody.getBoundingClientRect().left).toBeCloseTo(
      reviewCommentTitle?.getBoundingClientRect().left ?? -1,
      0,
    );
    const approvalBadge = canvas.getByText("Approved");
    await expect(approvalBadge).toHaveAttribute("data-chip-tone", "success");
    const approvalRow = approvalBadge.closest(
      ".community-projects__activity-item",
    ) as HTMLElement;
    await expect(
      approvalRow.querySelector(
        '[data-activity-kind="approval"] .lucide-check',
      ),
    ).not.toBeNull();
    const reviewRequest = canvas.getByText(/requested review in/u);
    const reviewRequestRow = reviewRequest.closest(
      ".community-projects__activity-item",
    );
    await expect(
      reviewRequestRow?.querySelector(
        '[data-activity-kind="review-request"] .lucide-user-plus',
      ),
    ).not.toBeNull();
    const assignmentRow = canvas
      .getByText(/^assigned a task in$/u)
      .closest(".community-projects__activity-item");
    await expect(
      assignmentRow?.querySelector(
        '[data-activity-kind="assignment"] .lucide-user-plus',
      ),
    ).not.toBeNull();
    const unassignmentRow = canvas
      .getByText(/^unassigned a task in$/u)
      .closest(".community-projects__activity-item");
    await expect(
      unassignmentRow?.querySelector(
        '[data-activity-kind="assignment"] .lucide-user-minus',
      ),
    ).not.toBeNull();
    const projectLink = within(reviewRequestRow as HTMLElement).getByRole(
      "button",
      { name: "Community Client" },
    );
    projectLink.click();
    await expect(onSelectProject).toHaveBeenCalledWith(fixture.project);
    await expect(getComputedStyle(reviewCommentBody).color).not.toBe(
      getComputedStyle(reviewCommentTitle!).color,
    );
    const activityWorkspace = canvasElement.querySelector(
      ".community-projects__workspace--activity",
    ) as HTMLElement;
    await expect(
      Number.parseFloat(getComputedStyle(activityWorkspace).paddingTop),
    ).toBeLessThanOrEqual(24);
    const restingBackground = getComputedStyle(approvalRow).backgroundColor;
    within(approvalRow)
      .getByRole("button", { name: /Add project file and diff views/u })
      .focus();
    await waitFor(() =>
      expect(getComputedStyle(approvalRow).backgroundColor).not.toBe(
        restingBackground,
      ),
    );
  }}
/>

<Story
  name="Activity loading"
  args={{
    view: "activity",
    selectedProject: undefined,
    projects: [],
    repositories: [],
    tasks: [],
    pullRequests: [],
    activity: [],
    loading: true,
  }}
  play={async ({ canvas }) => {
    const loader = canvas.getByRole("status", {
      name: "Loading project activity",
    });
    await expect(loader).toBeVisible();
    await expect(
      loader.querySelectorAll(".community-projects__activity-item--skeleton"),
    ).toHaveLength(4);
    await expect(
      canvas.queryByText("No project activity yet."),
    ).not.toBeInTheDocument();
  }}
/>

<Story
  name="Project overview"
  args={{
    view: "overview",
    tree: {
      ref: "main",
      sha: "d".repeat(40),
      path: "",
      entries: [
        { name: "README.md", path: "README.md", type: "blob", size: 912 },
        { name: "app.ts", path: "src/app.ts", type: "blob", size: 1_842 },
        { name: "index.ts", path: "src/index.ts", type: "blob", size: 318 },
      ],
      readme:
        "# Community Client\n\nNostr-native project collaboration for teams that work in channels and relay-hosted repositories.",
    },
    onSelectView,
  }}
  play={async ({ canvas, canvasElement }) => {
    const readme = canvasElement.querySelector(".community-projects__readme");
    await expect(readme).not.toBeNull();
    const markdown = readme!.querySelector<HTMLElement>(
      '[data-ui-component="community-markdown-content"]',
    );
    await expect(markdown).not.toBeNull();
    await expect(markdown).toHaveAttribute("data-full-width", "true");
    await expect(getComputedStyle(readme!).maxWidth).toBe("none");
    await expect(getComputedStyle(readme!).marginInlineStart).toBe("0px");
    const heading = within(readme as HTMLElement).getByRole("heading", {
      name: "Community Client",
      level: 1,
    });
    await expect(heading).toBeVisible();
    await expect(
      canvas.getByText(
        "Nostr-native project collaboration for teams that work in channels and relay-hosted repositories.",
      ),
    ).toBeVisible();
    const paddingLeft = Number.parseFloat(
      getComputedStyle(readme!).paddingLeft,
    );
    await expect(heading.getBoundingClientRect().left).toBeCloseTo(
      readme!.getBoundingClientRect().left + paddingLeft,
      1,
    );
  }}
/>

<Story
  name="Cached catalog fallback"
  args={{
    view: "projects",
    selectedProject: undefined,
    cachedCatalogAt: 1_700_000_000_000,
  }}
  play={async ({ canvas, canvasElement }) => {
    const notifications = within(canvasElement.ownerDocument.body);
    const projects = within(
      canvasElement.querySelector('[data-ui-component="community-projects"]')!,
    );
    const cachedNotice = await notifications.findByText(
      "Showing cached project catalog",
    );
    await waitFor(() => expect(cachedNotice).toBeVisible());
    await expect(
      projects.queryByText("Showing cached project catalog"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: /Community Client/u }),
    ).toBeVisible();
  }}
/>

<Story
  name="Cached catalog refresh failure"
  args={{
    view: "projects",
    selectedProject: undefined,
    cachedCatalogAt: 1_700_000_000_000,
    error: "The live project query timed out.",
    onRetry: fn(),
  }}
  play={async ({ args, canvas, canvasElement }) => {
    const notifications = within(canvasElement.ownerDocument.body);
    const projects = within(
      canvasElement.querySelector('[data-ui-component="community-projects"]')!,
    );
    const refreshFailure = await notifications.findByText(
      "Live project refresh failed",
    );
    await waitFor(() => expect(refreshFailure).toBeVisible());
    await expect(
      projects.queryByText("Live project refresh failed"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: /Community Client/u }),
    ).toBeVisible();
    await userEvent.click(notifications.getByRole("button", { name: "Retry" }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(
        notifications.getByText("Live project refresh failed"),
      ).toBeVisible(),
    );
  }}
/>

<Story
  name="Repository overview loading"
  args={{
    view: "overview",
    repositories: [githubRepository],
    repositoryCapabilities: githubRepositoryCapabilities,
    tree: undefined,
    loading: true,
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("status", { name: "Loading repository overview" }),
    ).toBeVisible();
    await expect(
      canvas.queryByText("Loading repository overview…"),
    ).not.toBeInTheDocument();
  }}
/>

<Story
  name="Project settings"
  args={{
    view: "overview",
    dialogRequest: {
      id: 2,
      kind: "edit-project",
      projectCoordinate: fixture.project.address.coordinate,
    },
    onUpdateProject: onUpdateProjectSettings,
  }}
  play={async () => {
    const overlay = within(document.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Project settings",
    });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await expect(name).toHaveValue("Community Client");
    await expect(
      within(dialog).getByLabelText("Project visibility"),
    ).toHaveTextContent("Public");
    await userEvent.clear(name);
    await userEvent.type(name, "Community Workspace");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Project list" }),
    );
    await userEvent.click(
      await overlay.findByRole("option", { name: "Unlisted" }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await expect(onUpdateProjectSettings).toHaveBeenCalledWith(
      fixture.project,
      {
        name: "Community Workspace",
        description: "The shared Lapis community experience.",
        channelId: "general-projects",
        listing: "unlisted",
      },
    );
  }}
/>

<Story
  name="GitHub repository link"
  args={{
    view: "repositories",
    repositories: [mineRepository, githubRepository],
    repositoryCapabilities: githubRepositoryCapabilities,
    tasks: [fixture.workItems.tasks[0], otherTask],
    pullRequests: fixture.workItems.pullRequests,
    activity: repositoryActivity,
  }}
  play={async ({ canvas, canvasElement }) => {
    const link = canvas.getByRole("link", {
      name: "Open community-client on GitHub",
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/lapismd/community-client",
    );
    await expect(canvas.getByRole("button", { name: "Mine" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(
      canvas.getByRole("button", { name: "Other repositories" }),
    ).toHaveAttribute("aria-expanded", "true");
    const commitActivity = canvas.getByRole("img", { name: "2 commits" });
    await expect(commitActivity).toBeVisible();
    await expect(canvas.getByRole("img", { name: "1 review" })).toBeVisible();
    await expect(canvas.getByRole("img", { name: "2 tasks" })).toBeVisible();
    await fireEvent.pointerEnter(commitActivity, { pointerType: "mouse" });
    await expect(commitActivity).toHaveAttribute("data-state", "instant-open");
    const activityTooltipProbe =
      canvasElement.ownerDocument.createElement("span");
    activityTooltipProbe.className =
      "community-projects__repository-activity-tooltip";
    activityTooltipProbe.style.color = "var(--background)";
    activityTooltipProbe.style.backgroundColor = "var(--foreground)";
    const activityDotProbe = canvasElement.ownerDocument.createElement("span");
    activityDotProbe.className =
      "community-projects__repository-activity-tooltip-dot community-projects__repository-activity-segment--commits";
    activityTooltipProbe.append(activityDotProbe);
    canvasElement.append(activityTooltipProbe);
    await expect(getComputedStyle(activityDotProbe).outlineWidth).toBe("1px");
    await expect(getComputedStyle(activityDotProbe).outlineColor).toBe(
      getComputedStyle(activityTooltipProbe).color,
    );
    await expect(getComputedStyle(activityDotProbe).backgroundColor).not.toBe(
      getComputedStyle(activityTooltipProbe).backgroundColor,
    );
    activityTooltipProbe.remove();
    await fireEvent.pointerLeave(commitActivity, { pointerType: "mouse" });
    await userEvent.click(
      canvas.getByRole("button", { name: "Other repositories" }),
    );
    await waitFor(async () => {
      await expect(link).not.toBeVisible();
    });
    await expect(
      canvas.getByRole("button", { name: "Other repositories 1" }),
    ).toHaveAttribute("aria-expanded", "false");
  }}
/>

<Story
  name="Connect GitHub repository"
  args={{
    view: "overview",
    selectedProject: undefined,
    selectedRepository: githubRepository,
    repositories: [githubRepository],
    repositoryCapabilities: {},
    canManageForge: true,
    dialogRequest: { id: 1, kind: "connect-github" },
    onLoadGitHubConnections,
    onLoadGitHubRepositories,
    onAttachGitHubRepository,
  }}
  play={async () => {
    const overlay = within(document.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Connect to a GitHub App",
    });
    await userEvent.click(
      within(dialog).getByRole("option", { name: /@lapismd/ }),
    );
    await expect(onLoadGitHubRepositories).toHaveBeenCalledWith("ghc-lapis");
    const repositoryDialog = await overlay.findByRole("dialog", {
      name: "Choose a repository from @lapismd",
    });
    await userEvent.click(
      await within(repositoryDialog).findByRole("option", {
        name: /lapismd\/community-client/,
      }),
    );
    await expect(onAttachGitHubRepository).toHaveBeenCalledWith(
      githubRepository,
      githubConnection,
      githubProviderRepository,
    );
  }}
/>

<Story
  name="Manage GitHub App connections"
  args={{
    view: "overview",
    selectedProject: undefined,
    selectedRepository: githubRepository,
    repositories: [githubRepository],
    repositoryCapabilities: githubRepositoryCapabilities,
    canManageForge: true,
    dialogRequest: { id: 2, kind: "manage-github" },
    onLoadGitHubConnections: onLoadManagedGitHubConnections,
    onCreateGitHubConnection,
    onUpdateGitHubConnection,
    onRevalidateGitHubConnection,
  }}
  play={async () => {
    const overlay = within(document.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "GitHub App connections",
    });
    await expect(
      within(dialog).getByText("github_installation_unavailable"),
    ).toBeVisible();
    await expect(within(dialog).getByText("error")).toBeVisible();
    await expect(dialog).not.toHaveTextContent("credential_ref");
    await expect(
      within(dialog).getByRole("button", { name: "Add connection" }),
    ).toBeVisible();
    const revalidate = within(dialog).getAllByRole("button", {
      name: "Revalidate",
    });
    await userEvent.click(revalidate[1]!);
    await expect(onRevalidateGitHubConnection).toHaveBeenCalledWith(
      "ghc-lapis-error",
    );
    await userEvent.click(
      within(dialog).getAllByRole("button", {
        name: "Replace configuration",
      })[1]!,
    );
    await expect(
      within(dialog).getByText(/relay never returns App IDs/u),
    ).toBeVisible();
    await expect(within(dialog).getByLabelText("GitHub App ID")).toHaveValue(
      "",
    );
    await expect(within(dialog).getByLabelText("Installation ID")).toHaveValue(
      100,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
  }}
/>

<Story
  name="Tasks"
  args={{
    view: "tasks",
    tasks: [groupedTask, otherTask],
    onSelectTask,
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("Polish the project overview rail"),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Mine" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(
      canvas.getByRole("button", { name: "Other tasks" }),
    ).toHaveAttribute("aria-expanded", "true");
    const noorAvatar = canvas.getByRole("button", {
      name: "View Noor Patel's profile",
    });
    const mayaAvatar = canvas.getAllByRole("button", {
      name: "View Maya Chen's profile",
    })[0]!;
    await expect(noorAvatar).toHaveAttribute("aria-haspopup", "dialog");
    await expect(mayaAvatar).toHaveAttribute("aria-haspopup", "dialog");
    await expect(
      getComputedStyle(noorAvatar.querySelector('[data-ui-part="image"]')!)
        .boxShadow,
    ).not.toBe("none");
    mayaAvatar.click();
    await expect(onOpenProfile).toHaveBeenCalledWith(fixture.members[0]);
    await userEvent.click(canvas.getByRole("button", { name: "Other tasks" }));
    await waitFor(async () => {
      await expect(
        canvas.getByText("Document the hosted repository flow"),
      ).not.toBeVisible();
    });
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Open task Polish the project overview rail",
      }),
    );
    await expect(onSelectTask).toHaveBeenCalledWith(groupedTask);
  }}
/>

<Story
  name="Project channels"
  args={{
    view: "channels",
    rooms: [
      {
        id: "release-room",
        groupId: "plugin-releases",
        name: "plugin-releases",
        kind: "channel",
      },
      {
        id: "general",
        groupId: fixture.project.channelId,
        name: "general",
        kind: "channel",
        description: "Plan and coordinate the Community client.",
        messageCount: 3,
        lastActivityAt: "2026-09-08T12:00:00.000Z",
      },
      {
        id: "support",
        groupId: fixture.project.relatedChannelIds[0],
        name: "support",
        kind: "channel",
        description: "Help Community contributors unblock their work.",
        messageCount: 12,
        lastActivityAt: "2026-09-09T14:30:00.000Z",
      },
    ],
    currentMemberId: projectStoryOwner,
    onSelectChannel,
    onUpdateProject: onRemoveProjectChannel,
  }}
  play={async ({ canvas, canvasElement }) => {
    onRemoveProjectChannel.mockClear();
    const channel = canvas.getByRole("button", {
      name: /#general Plan and coordinate the Community client/u,
    });
    await expect(within(channel).getByLabelText("3 messages")).toBeVisible();
    await expect(
      channel.querySelector('time[datetime="2026-09-08T12:00:00.000Z"]'),
    ).not.toBeNull();
    await userEvent.click(channel);
    await expect(onSelectChannel).toHaveBeenCalledWith("general");

    const rows = canvasElement.querySelectorAll(
      ".community-projects__channel-row",
    );
    await expect(rows).toHaveLength(2);
    for (const selector of [
      ".community-projects__channel-description",
      ".community-projects__row-count",
      ".community-projects__channel-activity",
    ]) {
      const first = rows[0]?.querySelector(selector)?.getBoundingClientRect();
      const second = rows[1]?.querySelector(selector)?.getBoundingClientRect();
      await expect(first?.left).toBeCloseTo(second?.left ?? -1, 0);
    }

    await userEvent.click(
      canvas.getByRole("button", { name: "Open #support project menu" }),
    );
    await userEvent.click(
      await within(document.body).findByRole("menuitem", {
        name: "Remove from project",
      }),
    );
    await expect(onRemoveProjectChannel).toHaveBeenLastCalledWith(
      fixture.project,
      {
        name: "Community Client",
        description: "The shared Lapis community experience.",
        channelId: "general-projects",
        listing: "listed",
        relatedChannelIds: [],
      },
    );

    await waitFor(() =>
      expect(
        getComputedStyle(canvas.getByRole("button", { name: "Add channel" }))
          .pointerEvents,
      ).not.toBe("none"),
    );
    onRemoveProjectChannel.mockRejectedValueOnce(
      new Error("Relay rejected the project update"),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Add channel" }));
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Add channel to Community Client",
    });
    await expect(
      within(dialog).queryByRole("option", { name: /#general/u }),
    ).toBeNull();
    await expect(
      within(dialog).queryByRole("option", { name: /#support/u }),
    ).toBeNull();
    await userEvent.click(
      within(dialog).getByRole("option", { name: /#plugin-releases/u }),
    );
    await waitFor(() =>
      expect(overlay.getByText("Channel could not be added")).toBeVisible(),
    );
    await expect(dialog).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("option", { name: /#plugin-releases/u }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await expect(onRemoveProjectChannel).toHaveBeenLastCalledWith(
      fixture.project,
      {
        name: fixture.project.name,
        description: fixture.project.description,
        channelId: fixture.project.channelId,
        listing: fixture.project.listing,
        relatedChannelIds: [
          ...fixture.project.relatedChannelIds,
          "plugin-releases",
        ],
      },
    );
  }}
/>

<Story
  name="Repository capabilities loading"
  args={{
    view: "repositories",
    repositories: [githubRepository],
    repositoryCapabilities: {},
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByRole("link", { name: "Open community-client" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: /community-client/u }),
    ).toBeVisible();
  }}
/>

<Story
  name="Task detail"
  args={{
    view: "tasks",
    selectedTask: fixture.workItems.tasks[0],
    onCloseTask,
    onUpdateTaskAssignment,
    onManageTaskAssignments,
    onAddTaskComment,
    onUpdateTaskLifecycle,
  }}
  play={async ({ canvas, canvasElement }) => {
    const detail = canvasElement.querySelector<HTMLElement>(
      ".community-projects__task-detail",
    )!;
    const rootFontSize = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    const availableWidth = detail.parentElement!.getBoundingClientRect().width;
    await expect(detail.getBoundingClientRect().width).toBeCloseTo(
      Math.min(availableWidth, 76 * rootFontSize),
      0,
    );
    await expect(
      Number.parseFloat(getComputedStyle(detail).paddingInlineStart),
    ).toBeCloseTo(1.25 * rootFontSize, 1);
    const description = detail.querySelector<HTMLElement>(
      ".community-projects__task-description-content",
    )!;
    await expect(
      canvas
        .getByText("Keep the shell shape aligned with plugin releases.")
        .getBoundingClientRect().left,
    ).toBeCloseTo(description.getBoundingClientRect().left, 0);
    await expect(
      canvas.getByRole("heading", { name: /Polish the project overview rail/ }),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        "The sidebar should stay contextual and quiet as the task changes.",
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole("group", { name: "Task comment" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Assign" }));
    await expect(onManageTaskAssignments).toHaveBeenCalledWith(
      fixture.workItems.tasks[0],
    );
  }}
/>

<Story
  name="Review diff"
  args={{
    view: "reviews",
    selectedPullRequest: fixture.pullRequest,
    pullRequestDiff: fixture.diff,
    repositoryCapabilities: githubMergeCapabilities,
    canCollaborate: true,
    onMergePullRequest,
    onAddPullRequestComment,
    onAddInlineComment,
    onSubmitPullRequestReview,
    onUpdatePullRequestLifecycle,
    onTogglePullRequestCommentReaction,
    reviewPreferenceStore,
    reviewPreferenceScope,
  }}
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("heading", {
        name: /Add project file and diff views/,
      }),
    ).toBeVisible();
    const mergeButton = canvas.getByRole("button", {
      name: "Merge pull request",
    });
    await expect(mergeButton).toBeEnabled();
    await userEvent.click(mergeButton);
    await expect(onMergePullRequest).toHaveBeenCalledWith(fixture.pullRequest);
    const filesChanged = canvas.getByRole("button", {
      name: "Files changed",
    });
    await userEvent.click(filesChanged);
    await expect(getComputedStyle(filesChanged).position).toBe("sticky");
    await expect(getComputedStyle(filesChanged).top).toBe("0px");
    await expect(getComputedStyle(filesChanged).borderBottomWidth).toBe("0px");
    const changedFilesToolbar = canvas
      .getByText("2 changed files")
      .closest<HTMLElement>(".community-projects__diff-summary");
    if (!changedFilesToolbar)
      throw new Error("Expected the changed-files toolbar");
    await expect(getComputedStyle(changedFilesToolbar).top).toBe("40px");
    const diffLayout = changedFilesToolbar.nextElementSibling as HTMLElement;
    const reviewSidebarToggle = canvas.getAllByRole("button", {
      name: "Hide changed files",
    })[0]!;
    await expect(
      reviewSidebarToggle.querySelector('[data-ui-part="sidebar-toggle-icon"]'),
    ).not.toBeNull();
    await userEvent.unhover(reviewSidebarToggle);
    await userEvent.hover(reviewSidebarToggle);
    await expect(
      getComputedStyle(reviewSidebarToggle).backgroundColor,
    ).not.toBe("rgba(0, 0, 0, 0)");
    await expect(getComputedStyle(reviewSidebarToggle).borderRadius).toBe(
      "8px",
    );
    await userEvent.click(reviewSidebarToggle);
    await expect(diffLayout).toHaveAttribute("data-file-list-open", "false");
    await expect(canvas.queryByLabelText("Changed files")).toBeNull();
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Show changed files" })[0]!,
    );
    await expect(diffLayout).toHaveAttribute("data-file-list-open", "true");
    await expect(canvas.getByLabelText("Changed files")).toBeVisible();
    await expect(canvas.getByLabelText("Message from You")).toHaveTextContent(
      "Can we retain a note explaining why projects were disabled?",
    );

    const reviewComment = canvas.getByLabelText("Message from You");
    const addReaction = reviewComment.querySelector<HTMLButtonElement>(
      'button[aria-label="Add reaction"]',
    );
    if (!addReaction) throw new Error("Expected the review reaction action");
    await userEvent.hover(reviewComment);
    await waitFor(() => expect(addReaction).toBeVisible());
    const heart = reviewComment.querySelector<HTMLButtonElement>(
      'button[aria-label="2 reactions with ❤️"]',
    );
    if (!heart) throw new Error("Expected the projected heart reaction");
    await userEvent.click(heart);
    await expect(onTogglePullRequestCommentReaction).toHaveBeenCalledWith(
      fixture.pullRequest,
      fixture.pullRequest.comments[1],
      "❤️",
    );

    const commentButton = canvas.getAllByRole("button", {
      name: "Comment on project.conf line 2",
    })[0]!;
    const diffRow = commentButton.closest<HTMLElement>(
      ".ui-diff-file-diff__row",
    );
    if (!diffRow) throw new Error("Expected the comment action's diff row");
    await userEvent.hover(diffRow);
    commentButton.focus();
    await expect(commentButton).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const composer = canvas.getByRole("group", {
      name: "Comment on project.conf line 2",
    });
    await userEvent.type(
      within(composer).getByRole("textbox"),
      "Please keep this flag documented.",
    );
    await userEvent.click(
      within(composer).getByRole("button", { name: "Comment" }),
    );
    await expect(onAddInlineComment).toHaveBeenCalledWith(fixture.pullRequest, {
      path: "project.conf",
      side: "old",
      line: 2,
      content: "Please keep this flag documented.",
    });

    const filter = canvas.getByRole("searchbox", {
      name: "Filter changed files",
    });
    await userEvent.type(filter, "readme");
    const readmeFile = canvas.getByRole("button", { name: "README.md" });
    await userEvent.click(readmeFile);
    await userEvent.click(readmeFile);
    const readmeSection = canvas
      .getByTitle("README.md")
      .closest("[data-ui-part='file-section']");
    await expect(readmeSection).toHaveAttribute("data-selected", "true");
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Mark README.md as viewed" }),
    );
    await expect(canvas.getByText("1 of 2 viewed")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse README.md" }),
    );
    await expect(canvas.queryByText("Project collaboration")).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand README.md" }),
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "Diff settings" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      body.getByRole("menuitemradio", { name: "Split diff" }),
    );
    await expect(
      canvas
        .getByTitle("README.md")
        .closest("[data-ui-component='file-diff-composer']"),
    ).toBeVisible();

    const submitReview = canvas.getByRole("button", {
      name: "Submit review",
    });
    submitReview.scrollIntoView({ block: "center" });
    await expect(submitReview).toBeEnabled();
    submitReview.focus();
    await expect(submitReview).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const dialog = body.getByRole("dialog", { name: "Submit review" });
    const reviewEditor = within(dialog).getByRole("textbox", {
      name: "Markdown editor",
    });
    const reviewDecision = within(dialog).getByRole("group", {
      name: "Review decision",
    });
    await expect(reviewEditor.getBoundingClientRect().top).toBeLessThan(
      reviewDecision.getBoundingClientRect().top,
    );
    const dialogClose = within(dialog).getByRole("button", { name: "Close" });
    const dialogCloseIcon = dialogClose.querySelector("svg");
    await expect(dialogCloseIcon).not.toBeNull();
    await expect(getComputedStyle(dialogCloseIcon!).width).toBe("16px");
    await expect(dialogClose).toHaveAttribute("data-variant", "ghost");
    const closeBackground = getComputedStyle(dialogClose).backgroundColor;
    dialogClose.focus();
    await waitFor(() =>
      expect(getComputedStyle(dialogClose).backgroundColor).not.toBe(
        closeBackground,
      ),
    );
    await userEvent.click(
      within(dialog).getByRole("radio", { name: "Request changes" }),
    );
    await userEvent.type(reviewEditor, "Please cover the filtered file path.");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Request changes" }),
    );
    await expect(onSubmitPullRequestReview).toHaveBeenCalledWith(
      fixture.pullRequest,
      {
        decision: "changes-requested",
        content: "Please cover the filtered file path.",
      },
    );
    await waitFor(() =>
      expect(
        body.queryByRole("dialog", { name: "Submit review" }),
      ).not.toBeInTheDocument(),
    );
    const closePullRequest = canvas.getByRole("button", { name: "Close" });
    closePullRequest.focus();
    await userEvent.keyboard("{Enter}");
    const closeDialog = body.getByRole("alertdialog", {
      name: "Close pull request?",
    });
    await expect(closeDialog).toBeVisible();
    await userEvent.click(
      within(closeDialog).getByRole("button", { name: "Close pull request" }),
    );
    await expect(onUpdatePullRequestLifecycle).toHaveBeenCalledWith(
      fixture.pullRequest,
      "closed",
    );
  }}
/>

<Story
  name="Merged review timeline"
  args={{
    view: "reviews",
    selectedPullRequest: mergedPullRequest,
    pullRequestDiff: fixture.diff,
    repositoryCapabilities: githubMergeCapabilities,
    canCollaborate: true,
    onMergePullRequest,
    onAddPullRequestComment,
    onSubmitPullRequestReview,
    onUpdatePullRequestLifecycle,
  }}
  play={async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Merged", { selector: "dd" })).toBeVisible();
    const openedText = canvas.getByText("opened this review");
    const openedSummary = openedText.closest<HTMLElement>(
      ".community-projects__review-timeline-summary",
    );
    if (!openedSummary) throw new Error("Expected the review opening summary");
    const actorMention = within(openedSummary).getByRole("button");
    await userEvent.hover(actorMention);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        body.getByRole("group", { name: /contact preview/u }),
      ).toBeVisible(),
    );
    const requestText = canvas.getByText("requested a review from");
    const requestSummary = requestText.closest<HTMLElement>(
      ".community-projects__review-timeline-summary",
    );
    if (!requestSummary) throw new Error("Expected the review request summary");
    await expect(requestSummary).toHaveTextContent("@maintainer");
    await expect(requestSummary).toHaveTextContent("@reviewer");
    await expect(canvas.getByText(/merged this review/u)).toBeVisible();
    await expect(canvas.getByText("eeeeeeee")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Merge pull request" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Submit review" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Reopen" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("group", { name: "Pull request comment" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Files changed" }),
    );
    await expect(canvas.getByText("2 changed files")).toBeVisible();
  }}
/>

<Story
  name="Review lifecycle groups"
  args={{
    view: "reviews",
    pullRequests: [mergedPullRequest, closedPullRequest],
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("Merged", { selector: "span" }),
    ).toBeVisible();
    await expect(
      canvas.getByText("Closed", { selector: "span" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Add project file and diff views" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Close superseded review" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Review diff failure"
  args={{
    view: "reviews",
    selectedPullRequest: fixture.pullRequest,
    pullRequestDiffError: "The relay could not load this comparison",
  }}
  play={async ({ canvas }) => {
    const filesChanged = canvas.getByRole("button", {
      name: "Files changed",
    });
    filesChanged.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "The relay could not load this comparison",
    );
  }}
/>

<Story
  name="GitHub-backed files"
  args={{
    view: "files",
    repositories: [githubRepository],
    repositoryCapabilities: githubRepositoryCapabilities,
    repositoryBranches: [
      { name: "main", sha: "d".repeat(40) },
      { name: "feature/files", sha: "e".repeat(40) },
    ],
    selectedRepositoryBranch: "main",
    tree: {
      ref: "main",
      sha: "d".repeat(40),
      path: "",
      entries: [
        { name: "README.md", path: "README.md", type: "blob", size: 912 },
        {
          name: "install.md",
          path: "docs/guides/setup/install.md",
          type: "blob",
          size: 2_410,
        },
        { name: "app.ts", path: "src/app.ts", type: "blob", size: 1_842 },
        { name: "index.ts", path: "src/index.ts", type: "blob", size: 318 },
        {
          name: "theme.css",
          path: "src/styles/theme.css",
          type: "blob",
          size: 644,
        },
      ],
      commit: hostedCommit,
    },
    selectedPath: "",
    onSelectPath,
    onSelectRepositoryBranch,
    onLoadRepositoryPathCommit,
    onSelectCommit,
  }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    onSelectPath.mockClear();
    onSelectRepositoryBranch.mockClear();
    onLoadRepositoryPathCommit.mockClear();
    onSelectCommit.mockClear();
    const browser = canvas.getByLabelText("Repository files");
    await expect(
      within(browser).getByRole("columnheader", { name: "Name" }),
    ).toBeVisible();
    await expect(
      within(browser).getByRole("columnheader", { name: "Commit message" }),
    ).toBeVisible();
    await expect(
      within(browser).getByRole("columnheader", { name: "Commit Date" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("img", { name: "noor@example.test" }),
    ).toBeVisible();
    await expect(canvas.getByText("Noor Patel")).toBeVisible();
    await expect(
      canvas.getByRole("button", {
        name: "View commit Add project file and diff views",
      }),
    ).toBeVisible();
    await expect(
      canvas.queryByLabelText("Repository file tree"),
    ).not.toBeInTheDocument();
    await expect(
      await within(browser).findByText("Update README.md"),
    ).toBeVisible();
    await expect(browser.querySelector("time")).not.toBeNull();
    await expect(
      canvas.getByRole("button", {
        name: `Copy full commit ID: ${"d".repeat(40)}`,
      }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", {
        name: "View commit Add project file and diff views",
      }),
    );
    await expect(onSelectCommit).toHaveBeenCalledWith(hostedCommit);
    await userEvent.click(
      canvas.getByRole("button", { name: "Show repository file tree" }),
    );
    await expect(canvas.getByLabelText("Repository file tree")).toBeVisible();
    await expect(
      within(browser).getByRole("button", {
        name: "Open directory docs/guides/setup",
      }),
    ).toBeVisible();
    await expect(
      within(browser).getByRole("button", { name: "Open directory src" }),
    ).toBeVisible();
    await userEvent.click(
      within(browser).getByRole("button", {
        name: "Open directory docs/guides/setup",
      }),
    );
    const breadcrumb = canvas.getByRole("navigation", { name: "breadcrumb" });
    await expect(within(breadcrumb).getByText("docs")).toBeVisible();
    await expect(within(breadcrumb).getByText("guides")).toBeVisible();
    await expect(within(breadcrumb).getByText("setup")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Open file install.md" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Go to parent directory" }),
    ).toBeVisible();
    await expect(onSelectPath).not.toHaveBeenCalled();
    await userEvent.click(
      within(breadcrumb).getByRole("link", { name: "community-client" }),
    );
    await expect(
      canvas.getByRole("button", {
        name: "Open directory docs/guides/setup",
      }),
    ).toBeVisible();
    const fileTree = canvas.getByLabelText("Repository file tree");
    await userEvent.click(
      within(fileTree).getByRole("button", { name: "README.md" }),
    );
    await expect(onSelectPath).toHaveBeenCalledWith("README.md");
    await expect(canvas.getByLabelText("Repository file tree")).toBeVisible();
    await userEvent.click(
      within(canvas.getByRole("navigation", { name: "breadcrumb" })).getByRole(
        "link",
        { name: "Files" },
      ),
    );
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Repository branch" }),
    );
    await userEvent.click(page.getByRole("option", { name: "feature/files" }));
    await expect(onSelectRepositoryBranch).toHaveBeenCalledWith(
      "feature/files",
    );
  }}
/>

<Story
  name="Markdown file preview"
  args={{
    view: "files",
    repositories: [githubRepository],
    repositoryCapabilities: githubRepositoryCapabilities,
    tree: {
      ref: "main",
      sha: "d".repeat(40),
      path: "",
      entries: [
        { name: "README.md", path: "README.md", type: "blob", size: 912 },
      ],
      commit: hostedCommit,
    },
    selectedPath: "README.md",
    blob: {
      name: "README.md",
      path: "README.md",
      contents: "# Community Client\n\nNostr-native project collaboration.",
      size: 55,
    },
    onSelectPath,
  }}
  play={async ({ canvas }) => {
    const preview = canvas.getByRole("button", { name: "Preview" });
    const source = canvas.getByRole("button", { name: "Source" });
    await expect(preview).toHaveAttribute("aria-pressed", "true");
    await expect(source).toHaveAttribute("aria-pressed", "false");
    await expect(
      canvas.getByRole("heading", { name: "Community Client" }),
    ).toBeVisible();
    const filePanel = canvas
      .getByRole("navigation", { name: "breadcrumb" })
      .closest<HTMLElement>(".community-projects__file-panel");
    await expect(filePanel).not.toBeNull();
    await expect(getComputedStyle(filePanel!).borderTopWidth).toBe("1px");
    await expect(getComputedStyle(filePanel!).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Show repository file tree" }),
    );
    await expect(canvas.getByLabelText("Repository file tree")).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "Community Client" }),
    ).toBeVisible();
    await userEvent.click(source);
    await expect(source).toHaveAttribute("aria-pressed", "true");
    await expect(
      filePanel!.querySelector('[data-ui-component="code-block"]'),
    ).not.toBeNull();
    await userEvent.click(preview);
    await expect(
      canvas.getByRole("heading", { name: "Community Client" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Repository file preview loading"
  args={{
    view: "files",
    repositories: [githubRepository],
    repositoryCapabilities: githubRepositoryCapabilities,
    tree: {
      ref: "main",
      sha: "d".repeat(40),
      path: "",
      entries: [
        { name: "README.md", path: "README.md", type: "blob", size: 912 },
        { name: "app.ts", path: "src/app.ts", type: "blob", size: 1_842 },
      ],
    },
    selectedPath: "README.md",
    loading: true,
    onSelectPath,
  }}
  play={async ({ canvas }) => {
    const loader = canvas.getByRole("status", { name: "Loading README.md" });
    await expect(loader).toBeVisible();
    const project = loader.closest<HTMLElement>(".community-projects");
    const tabs = project?.querySelector<HTMLElement>(
      ":scope > .community-projects__tabs",
    );
    const filePanel = project?.querySelector<HTMLElement>(
      ".community-projects__file-panel",
    );
    await expect(project).not.toBeNull();
    await expect(tabs).not.toBeNull();
    await expect(filePanel).not.toBeNull();
    const projectBounds = project!.getBoundingClientRect();
    const tabsBounds = tabs!.getBoundingClientRect();
    const filePanelBounds = filePanel!.getBoundingClientRect();
    await expect(tabsBounds.top).toBeCloseTo(projectBounds.top, 0);
    await expect(tabsBounds.width).toBeCloseTo(projectBounds.width, 0);
    await expect(filePanelBounds.left).toBeGreaterThanOrEqual(
      projectBounds.left,
    );
    await expect(filePanelBounds.right).toBeLessThanOrEqual(
      projectBounds.right,
    );
    await expect(
      loader.querySelector(".community-projects__markdown-skeleton-title"),
    ).not.toBeNull();
    const fileHeader = filePanel!.querySelector<HTMLElement>(
      ".community-projects__file-header",
    );
    await expect(fileHeader).not.toBeNull();
    await expect(getComputedStyle(fileHeader!).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
  }}
/>

<Story
  name="Repository files loading"
  args={{
    view: "files",
    repositories: [githubRepository],
    repositoryCapabilities: githubRepositoryCapabilities,
    tree: undefined,
    selectedPath: "",
    loading: true,
  }}
  play={async ({ canvas }) => {
    const loader = canvas.getByRole("status", {
      name: "Loading repository files",
    });
    await expect(loader).toBeVisible();
    await expect(
      loader.querySelector(".community-projects__files-loading-breadcrumb"),
    ).not.toBeNull();
    await expect(
      loader.querySelector(".community-projects__files-loading-commit"),
    ).not.toBeNull();
    const project = loader.closest<HTMLElement>(".community-projects");
    const tabs = project?.querySelector<HTMLElement>(
      ":scope > .community-projects__tabs",
    );
    await expect(project).not.toBeNull();
    await expect(tabs).not.toBeNull();
    const projectBounds = project!.getBoundingClientRect();
    const tabsBounds = tabs!.getBoundingClientRect();
    const loaderBounds = loader.getBoundingClientRect();
    await expect(tabsBounds.top).toBeCloseTo(projectBounds.top, 0);
    await expect(tabsBounds.width).toBeCloseTo(projectBounds.width, 0);
    await expect(loaderBounds.top).toBeGreaterThan(tabsBounds.bottom);
    await expect(loaderBounds.left).toBeGreaterThanOrEqual(projectBounds.left);
    await expect(loaderBounds.right).toBeLessThanOrEqual(projectBounds.right);
    await expect(
      canvas.queryByText("Loading repository files…"),
    ).not.toBeInTheDocument();
  }}
/>

<Story
  name="Commit detail"
  args={{
    view: "commits",
    commits: [hostedCommit],
    selectedCommit: hostedCommit,
    selectedCommitDetail: hostedCommitDetail,
    showNavigation: false,
    onCloseCommit,
  }}
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("heading", {
        name: "Add project file and diff views",
      }),
    ).toBeVisible();
    await expect(canvas.getByLabelText("Changed files")).toBeVisible();
    await expect(canvas.getByLabelText("Commit diff")).toBeVisible();
    await expect(
      canvas.getByRole("group", { name: "File listing view mode" }),
    ).toBeVisible();
    await expect(canvas.getByText("2 changed files")).toBeVisible();
    const filesChanged = canvas.getByRole("button", {
      name: "Files changed 2",
    });
    await expect(getComputedStyle(filesChanged).top).toBe("0px");
    const changedFilesToolbar = canvas
      .getByText("2 changed files")
      .closest<HTMLElement>(".community-projects__diff-summary");
    if (!changedFilesToolbar)
      throw new Error("Expected the commit changed-files toolbar");
    await expect(getComputedStyle(changedFilesToolbar).top).toBe("40px");

    const commitDiffLayout = canvas
      .getByLabelText("Changed files")
      .closest<HTMLElement>(".community-projects__diff-layout");
    if (!commitDiffLayout) throw new Error("Expected the commit diff layout");
    const sidebarToggle = canvas.getAllByRole("button", {
      name: "Hide changed files",
    })[0]!;
    await expect(
      sidebarToggle.querySelector('[data-ui-part="sidebar-toggle-icon"]'),
    ).not.toBeNull();
    await userEvent.unhover(sidebarToggle);
    await userEvent.hover(sidebarToggle);
    await expect(getComputedStyle(sidebarToggle).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await expect(getComputedStyle(sidebarToggle).borderRadius).toBe("8px");
    await userEvent.click(sidebarToggle);
    await expect(commitDiffLayout).toHaveAttribute(
      "data-file-list-open",
      "false",
    );
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Show changed files" })[0]!,
    );
    await expect(commitDiffLayout).toHaveAttribute(
      "data-file-list-open",
      "true",
    );

    const filter = canvas.getByRole("searchbox", {
      name: "Filter changed files",
    });
    await userEvent.type(filter, "readme");
    await expect(
      canvas.getByRole("button", { name: "README.md" }),
    ).toBeVisible();
    await expect(
      canvasElement.querySelector('[data-diff-file-path="src/projects.ts"]'),
    ).toBeNull();
    await userEvent.clear(filter);
    await userEvent.click(
      canvas.getByRole("button", { name: "src/projects.ts" }),
    );
    const selectedFile = canvasElement.querySelector(
      '[data-diff-file-path="src/projects.ts"]',
    );
    await expect(selectedFile).toHaveAttribute("data-selected", "true");
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse src/projects.ts" }),
    );
    await expect(selectedFile).toHaveAttribute("data-collapsed", "true");

    await userEvent.click(
      canvas.getByRole("button", { name: "Diff settings" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      body.getByRole("menuitemradio", { name: "Split diff" }),
    );
    await expect(
      canvasElement.querySelector('[data-view-mode="split"]'),
    ).not.toBeNull();
  }}
/>

<Story
  name="People narrow"
  args={{ view: "people" }}
  globals={{
    viewport: { value: "mobile2", isRotated: false },
  }}
/>

<Story
  name="Channel attachment requires owner"
  args={{
    view: "channels",
    currentMemberId: projectStoryAuthor,
    onUpdateProject: onRemoveProjectChannel,
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Add channel" }),
    ).toBeDisabled();
  }}
/>

<Story
  name="Choose project for channel attachment"
  args={{
    view: "channels",
    selectedProject: undefined,
    projects: [
      fixture.project,
      {
        ...fixture.project,
        name: "Documentation",
        address: {
          ...fixture.project.address,
          coordinate: `${fixture.project.address.coordinate}-docs`,
        },
      },
    ],
    currentMemberId: projectStoryOwner,
    rooms: [
      {
        id: "spare",
        groupId: "spare-channel",
        name: "spare",
        kind: "channel",
        isProjectChannel: true,
      },
      { id: "archived", name: "archived", kind: "channel", archived: true },
    ],
    onUpdateProject: onRemoveProjectChannel,
  }}
  play={async ({ canvas, canvasElement }) => {
    onRemoveProjectChannel.mockClear();
    await userEvent.click(canvas.getByRole("button", { name: "Add channel" }));
    const overlay = within(canvasElement.ownerDocument.body);
    const chooser = await overlay.findByRole("dialog", {
      name: "Choose a project",
    });
    await userEvent.type(
      within(chooser).getByRole("combobox"),
      "Documentation",
    );
    await userEvent.click(
      within(chooser).getByRole("option", { name: "Documentation" }),
    );
    const dialog = await overlay.findByRole("dialog", {
      name: "Add channel to Documentation",
    });
    await expect(within(dialog).getByRole("combobox")).toHaveValue("");
    await expect(
      within(dialog).queryByRole("option", { name: /archived/u }),
    ).toBeNull();
    const spare = within(dialog).getByRole("option", { name: /^#spare\b/u });
    await expect(
      spare.querySelector('[data-ui-part="project-channel-icon"]'),
    ).toBeVisible();
    await userEvent.click(spare);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await expect(onRemoveProjectChannel).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Documentation" }),
      expect.objectContaining({
        relatedChannelIds: [
          ...fixture.project.relatedChannelIds,
          "spare-channel",
        ],
      }),
    );
  }}
/>

<Story
  name="Log workspace regions"
  args={{
    view: "log",
    selectedRepository: fixture.catalog.repositories[0],
    workItemEvents: [],
  }}
  play={async ({ canvas }) => {
    const projectsBody = canvas.getByRole("main", {
      name: `${fixture.project.name} projects`,
    });
    await expect(projectsBody).toHaveAttribute("data-layout", "regions");
    await expect(
      projectsBody.querySelector(":scope > [data-ui-component='scroll-area']"),
    ).toBeNull();
  }}
/>
