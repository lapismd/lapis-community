<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import Harness from "./CommunityAgentsApplicationStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Application/Agents",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityApplication } from "@lapismd/lapis-community/components";
<\/script>
<CommunityApplication {controller} initialDestination="agents" displayMode="auto" />`,
        },
      },
    },
  });
</script>

<Story
  name="Discovery capture and history"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.findByRole("button", { name: "View Research" }),
    ).resolves.toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Emit fixture activity" }),
    );
    await expect(
      canvas.findByText("Working", { exact: true }),
    ).resolves.toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "View Research" }),
    );
    await expect(
      canvas.getByRole("article", { name: "Research agent profile" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Follow", exact: true }),
    );
    await expect(
      canvas.findByRole("button", { name: "Unfollow", exact: true }),
    ).resolves.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Activity log" }));
    await expect(
      canvas.findByText("Captured while the activity panel was closed"),
    ).resolves.toBeVisible();
    await waitFor(() =>
      expect(canvasElement.ownerDocument.defaultView!.location.hash).toContain(
        "activity=1",
      ),
    );
    canvasElement.ownerDocument.defaultView!.history.back();
    await expect(
      canvas.findByRole("article", { name: "Research agent profile" }),
    ).resolves.toBeVisible();
    await userEvent.click(
      canvas.getByRole("tab", { name: "Channels", exact: true }),
    );
    await expect(
      canvas.getByRole("button", { name: "# general", exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("tab", { name: "Info", exact: true }),
    );
    await userEvent.click(
      within(
        canvas.getByRole("article", { name: "Research agent profile" }),
      ).getByRole("button", { name: "Message", exact: true }),
    );
    await expect(
      canvas.findByRole("textbox", { name: "Markdown editor" }),
    ).resolves.toBeVisible();
  }}>{#snippet template()}<Harness />{/snippet}</Story
>
<Story
  name="Mobile profile navigation"
  play={async ({ canvas }) => {
    await expect(
      canvas.findByRole("button", { name: "View Research" }),
    ).resolves.toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "View Research" }),
    );
    await expect(
      canvas.findByRole("article", { name: "Research agent profile" }),
    ).resolves.toBeVisible();
    await waitFor(() => {
      const shell = canvas
        .getByRole("group", { name: "Mobile application shell" })
        .getBoundingClientRect();
      const profile = canvas
        .getByRole("article", { name: "Research agent profile" })
        .getBoundingClientRect();
      expect(profile.left).toBeGreaterThanOrEqual(shell.left - 1);
      expect(profile.right).toBeLessThanOrEqual(shell.right + 1);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Activity log" }));
    await expect(
      canvas.getByRole("region", { name: "Agent activity history" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to profile" }),
    );
    await expect(
      canvas.getByRole("article", { name: "Research agent profile" }),
    ).toBeVisible();
    await waitFor(() => {
      const shell = canvas
        .getByRole("group", { name: "Mobile application shell" })
        .getBoundingClientRect();
      const profile = canvas
        .getByRole("article", { name: "Research agent profile" })
        .getBoundingClientRect();
      expect(profile.left).toBeGreaterThanOrEqual(shell.left - 1);
      expect(profile.right).toBeLessThanOrEqual(shell.right + 1);
    });
  }}>{#snippet template()}<Harness narrow />{/snippet}</Story
>
