<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";

  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";
  import { projectStoryRepositoryCoordinate } from "../community-projects/story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell/Repository Query Cache",
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
  name="Repository files return from cache"
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByText(
        "Nostr-native project collaboration.",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("tab", { name: "Files", exact: true }),
    );
    await userEvent.click(
      await canvas.findByRole(
        "button",
        {
          name: "Open file README.md",
          exact: true,
        },
        { timeout: 15_000 },
      ),
    );
    await expect(
      await canvas.findByText(
        "Nostr-native project collaboration.",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Overview" }));
    await expect(
      await canvas.findByText(
        "Nostr-native project collaboration.",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("tab", { name: "Files", exact: true }),
    );
    await userEvent.click(
      await canvas.findByRole(
        "button",
        {
          name: "Open file README.md",
          exact: true,
        },
        { timeout: 15_000 },
      ),
    );
    await expect(
      await canvas.findByText(
        "Nostr-native project collaboration.",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Overview" }));
    await expect(
      await canvas.findByText(
        "Nostr-native project collaboration.",
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="repository-query-cache"
      projects
      initialDestination="projects"
      initialHash={`#/projects/repository/${projectStoryRepositoryCoordinate}`}
    />
  {/snippet}
</Story>
