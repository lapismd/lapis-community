<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";
  import { projectStoryRepositoryCoordinate } from "../community-projects/story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell/Repository Loading",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: {
          language: "svelte",
          code: `<script lang="ts">
  import { CommunityApplication } from "@lapismd/lapis-community/components";
<\/script>

<CommunityApplication {controller} projectsOptions={{ source }} />`,
        },
      },
    },
  });
</script>

<Story
  name="Repository overview settles after revision discovery"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await expect(
      await canvas.findByText(
        "Nostr-native project collaboration.",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("status", { name: "Loading repository overview" }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(
      canvas.getByRole("tab", { name: "Files", exact: true }),
    );
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Open file README.md",
        exact: true,
      }),
    );
    await expect(
      await canvas.findByText("Nostr-native project collaboration."),
    ).toBeVisible();
    await waitFor(() =>
      expect(window.location.hash).toContain(
        `/${"d".repeat(40)}/files/README.md`,
      ),
    );
    await userEvent.click(canvas.getByRole("tab", { name: "Overview" }));
    await expect(
      await canvas.findByText("Nostr-native project collaboration."),
    ).toBeVisible();
    await expect(application).toHaveAttribute(
      "data-project-session-open-count",
      "1",
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="repository-loading"
      projects
      initialDestination="projects"
      initialHash={`#/projects/repository/${projectStoryRepositoryCoordinate}`}
    />
  {/snippet}
</Story>
