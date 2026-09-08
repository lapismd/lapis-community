<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import CommunityProjects from "./CommunityProjects.svelte";
  import { buildProjectForgeActivity } from "../../projects/index.js";
  import {
    createProjectStoryFixture,
    projectStoryAuthor,
  } from "./story-fixtures.js";

  const fixture = createProjectStoryFixture();
  const onSelectProject = fn();
  const onSelectView = fn();
  const onUpdateTaskLifecycle = fn(async () => undefined);
  const onAddPullRequestComment = fn(async () => undefined);
  const onAddInlineComment = fn(async () => undefined);

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
    component: CommunityProjects,
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
      commits: [
        {
          sha: "d".repeat(40),
          subject: "Add project file and diff views",
          body: "Use the public Design Core diff primitives.",
          author_name: "Noor Patel",
          author_date: "2026-09-08T09:30:00Z",
        },
      ],
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
        { name: "README.md", type: "blob", size: 912 },
        { name: "src", type: "tree" },
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
  args={{ view: "tasks", onUpdateTaskLifecycle }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("Polish the project overview rail"),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await expect(onUpdateTaskLifecycle).toHaveBeenCalledWith(
      fixture.workItems.tasks[0],
      "closed",
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
      canvas.getByRole("heading", { name: "Add project file and diff views" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Merge unavailable" }),
    ).toBeDisabled();
    await expect(canvas.getByLabelText("Message from You")).toHaveTextContent(
      "Can we retain a note explaining why projects were disabled?",
    );

    await userEvent.click(
      canvas.getAllByRole("button", {
        name: "Comment on project.conf line 2",
      })[0]!,
    );
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
        { name: "README.md", type: "blob", size: 912 },
        { name: "src", type: "tree" },
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
  name="People narrow"
  args={{ view: "people" }}
  globals={{
    viewport: { value: "mobile2", isRotated: false },
  }}
/>
