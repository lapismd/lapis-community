<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell",
    component: CommunityApplication,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Projects toolbar back follows history"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
    await expect(
      await canvas.findByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    const repositoriesTab = canvas.getByRole("tab", { name: "Repositories" });
    await waitFor(
      () =>
        expect(getComputedStyle(repositoriesTab).pointerEvents).not.toBe(
          "none",
        ),
      { timeout: 15_000 },
    );
    await userEvent.click(repositoriesTab);
    await expect(
      await canvas.findByRole("heading", { name: "Repositories" }),
    ).toBeVisible();
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /community-client Hosted browser and desktop client/u,
      }),
    );
    await expect(
      await canvas.findByRole("tab", { name: "Overview" }),
    ).toHaveAttribute("aria-selected", "true");
    const toolbar = canvas.getByRole("banner", { name: "Project sections" });
    await userEvent.click(
      within(toolbar).getByRole("button", { name: "Back" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Repositories" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("tab", { name: "Repositories" }),
    ).toHaveAttribute("aria-selected", "true");
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="projects-toolbar-back"
      projects
      initialDestination="projects"
    />
  {/snippet}
</Story>
