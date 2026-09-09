<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import CommunityProjectsStoryHarness from "./CommunityProjectsStoryHarness.svelte";
  import { buildProjectForgeActivity } from "../../projects/index.js";
  import {
    createProjectStoryFixture,
    projectStoryAuthor,
    projectStoryRepositoryCoordinate,
  } from "./story-fixtures.js";

  const fixture = createProjectStoryFixture();
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
      collaboration_backend: "relay",
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
  const onSelectProject = fn();
  const onSelectChannel = fn();
  const onSelectView = fn();
  const onOpenProfile = fn();
  const onMessageMember = fn();
  const onWaveMember = fn();
  const onUpdateProject = fn(async () => undefined);
  const onUpdateTaskLifecycle = fn(async () => undefined);
  const onUpdateTaskAssignment = fn(async () => undefined);
  const onManageTaskAssignments = fn();
  const onAddTaskComment = fn(async () => undefined);
  const onSelectTask = fn();
  const onCloseTask = fn();
  const onCloseCommit = fn();
  const onSelectPath = fn();
  const onAutoSelectPath = fn();
  const onAddPullRequestComment = fn(async () => undefined);
  const onAddInlineComment = fn(async () => undefined);
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
  const onLoadGitHubRepositories = fn(async () => ({
    repositories: [githubProviderRepository],
  }));
  const onAttachGitHubRepository = fn(async () => undefined);
  const hostedCommit = {
    sha: "d".repeat(40),
    subject: "Add project file and diff views",
    body: "Use the public Design Core diff primitives.",
    author_name: "Noor Patel",
    author_date: "2026-09-08T09:30:00Z",
  };
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
      currentMemberId: projectStoryAuthor,
      canCollaborate: true,
    },
  });
</script>

<Story
  name="Activity workspace"
  args={{
    view: "activity",
    selectedProject: undefined,
    repositories: fixture.catalog.repositories,
    activity: buildProjectForgeActivity(fixture.catalog, fixture.workItems),
    onSelectProject,
    onSelectView,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    const actorAvatar = canvas.getAllByRole("button", {
      name: "View Maya Chen's profile",
    })[0]!;
    await expect(actorAvatar).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(actorAvatar);
    await userEvent.unhover(actorAvatar);
    await expect(onOpenProfile).toHaveBeenCalledWith(fixture.members[0]);
    const repositoryActivity = canvas.getByRole("button", {
      name: /^community-client Hosted browser and desktop client\./u,
    });
    await expect(
      repositoryActivity.querySelector(".lucide-folder-git-2"),
    ).not.toBeNull();
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
  play={async ({ canvas }) => {
    await expect(
      canvas.getAllByRole("heading", { name: "Community Client", level: 1 })[0],
    ).toBeVisible();
    await expect(
      canvas.getByText(
        "Nostr-native project collaboration for teams that work in channels and relay-hosted repositories.",
      ),
    ).toBeVisible();
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
    onUpdateProject,
  }}
  play={async () => {
    const overlay = within(document.body);
    const dialog = await overlay.findByRole("dialog", {
      name: "Project settings",
    });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await expect(name).toHaveValue("Community Client");
    await userEvent.clear(name);
    await userEvent.type(name, "Community Workspace");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await expect(onUpdateProject).toHaveBeenCalledWith(fixture.project, {
      name: "Community Workspace",
      description: "The shared Lapis community experience.",
      channelId: "general-projects",
      visibility: "public",
    });
  }}
/>

<Story
  name="GitHub repository link"
  args={{
    view: "repositories",
    repositories: [githubRepository],
    repositoryCapabilities: githubRepositoryCapabilities,
  }}
  play={async ({ canvas }) => {
    const link = canvas.getByRole("link", {
      name: "Open community-client on GitHub",
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/lapismd/community-client",
    );
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
    await userEvent.click(
      await within(dialog).findByRole("option", {
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
  name="Tasks"
  args={{ view: "tasks", onSelectTask }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("Polish the project overview rail"),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: /Polish the project overview rail/ }),
    );
    await expect(onSelectTask).toHaveBeenCalledWith(fixture.workItems.tasks[0]);
  }}
/>

<Story
  name="Project channels"
  args={{
    view: "channels",
    rooms: [
      {
        id: "general",
        groupId: fixture.project.channelId,
        name: "general",
        kind: "channel",
        description: "Plan and coordinate the Community client.",
        messageCount: 3,
        lastActivityAt: "2026-09-08T12:00:00.000Z",
      },
    ],
    onSelectChannel,
  }}
  play={async ({ canvas }) => {
    const channel = canvas.getByRole("button", {
      name: /#general Plan and coordinate the Community client/u,
    });
    await expect(within(channel).getByLabelText("3 messages")).toBeVisible();
    await expect(
      channel.querySelector('time[datetime="2026-09-08T12:00:00.000Z"]'),
    ).not.toBeNull();
    await userEvent.click(channel);
    await expect(onSelectChannel).toHaveBeenCalledWith("general");
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
  play={async ({ canvas }) => {
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
    onAddPullRequestComment,
    onAddInlineComment,
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", {
        name: /Add project file and diff views/,
      }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Merge unavailable" }),
    ).toBeDisabled();
    await expect(canvas.getByLabelText("Message from You")).toHaveTextContent(
      "Can we retain a note explaining why projects were disabled?",
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "Files changed" }),
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
    await userEvent.click(
      canvas.getByRole("button", { name: "Files changed" }),
    );
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
    tree: {
      ref: "main",
      sha: "d".repeat(40),
      path: "",
      entries: [
        { name: "README.md", path: "README.md", type: "blob", size: 912 },
        { name: "app.ts", path: "src/app.ts", type: "blob", size: 1_842 },
        { name: "index.ts", path: "src/index.ts", type: "blob", size: 318 },
      ],
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
    onSelectPath.mockClear();
    await userEvent.click(
      canvas.getByRole("button", { name: "README.md", exact: true }),
    );
    await expect(onSelectPath).not.toHaveBeenCalled();
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
    selectedPath: "",
    loading: true,
    onSelectPath: onAutoSelectPath,
  }}
  play={async ({ canvas }) => {
    await waitFor(() =>
      expect(onAutoSelectPath).toHaveBeenCalledWith("README.md"),
    );
    await expect(
      canvas.getByRole("status", { name: "Loading README.md" }),
    ).toBeVisible();
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
      loader.querySelector(".community-projects__files-loading-sidebar"),
    ).not.toBeNull();
    await expect(
      loader.querySelector(".community-projects__files-loading-preview"),
    ).not.toBeNull();
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
    onCloseCommit,
  }}
  play={async ({ canvas }) => {
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
  }}
/>

<Story
  name="People narrow"
  args={{ view: "people" }}
  globals={{
    viewport: { value: "mobile2", isRotated: false },
  }}
/>
