<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import CommunityProjectsStoryHarness from "./CommunityProjectsStoryHarness.svelte";
  import { buildProjectForgeActivity } from "../../projects/index.js";
  import {
    createProjectStoryFixture,
    projectStoryAuthor,
  } from "./story-fixtures.js";

  const fixture = createProjectStoryFixture();
  const onSelectProject = fn();
  const onSelectView = fn();
  const onUpdateTaskLifecycle = fn(async () => undefined);
  const onUpdateTaskAssignment = fn(async () => undefined);
  const onManageTaskAssignments = fn();
  const onAddTaskComment = fn(async () => undefined);
  const onSelectTask = fn();
  const onCloseTask = fn();
  const onCloseCommit = fn();
  const onAddPullRequestComment = fn(async () => undefined);
  const onAddInlineComment = fn(async () => undefined);
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
            "The Nostr-native project directory and task, review, hosted file, commit, and people surfaces used by the Community application shell.",
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
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Projects" }));
    await expect(onSelectView).toHaveBeenCalledWith("projects");
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
  name="Hosted files"
  args={{
    view: "files",
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
