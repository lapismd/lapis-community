<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import Harness from "./CommunityAgentsApplicationStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Application",
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
  name="Application body shell"
  parameters={{ layout: "fullscreen", communityAppShell: true }}
  play={async ({ canvas }) => {
    const pageHeader = await canvas.findByLabelText("Agents page header");
    const directory = await canvas.findByRole("region", {
      name: "Your agents",
    });
    const heading = within(pageHeader).getByRole("heading", {
      name: "Agents",
      level: 1,
    });
    const refresh = await within(pageHeader).findByRole("button", {
      name: "Refresh agents",
    });
    await expect(refresh).toHaveTextContent("");
    await expect(
      within(directory).getByText("Your registered agents in this community."),
    ).toBeVisible();
    const addAgent = await within(directory).findByRole("button", {
      name: "Add agent",
    });
    await expect(
      within(directory).queryByRole("heading", { name: "Agents", level: 1 }),
    ).not.toBeInTheDocument();
    await expect(
      within(directory).queryByRole("button", { name: "Refresh agents" }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      const headingBounds = heading.getBoundingClientRect();
      const addBounds = addAgent.getBoundingClientRect();
      const refreshBounds = refresh.getBoundingClientRect();
      const directoryBounds = directory.getBoundingClientRect();
      expect(headingBounds.left - directoryBounds.left).toBeCloseTo(16, 0);
      expect(addBounds.left - directoryBounds.left).toBeCloseTo(16, 0);
      expect(directoryBounds.right - refreshBounds.right).toBeCloseTo(16, 0);
    });
  }}
>
  {#snippet template()}
    <Harness showControls={false} />
  {/snippet}
</Story>

<Story
  name="Agent owner profile navigation"
  play={async ({ canvas, canvasElement }) => {
    const applicationHeader = await canvas.findByRole("navigation", {
      name: "Application navigation",
    });
    const pageHeader = await canvas.findByLabelText("Agents page header");
    await expect(
      within(pageHeader).getByRole("heading", {
        name: "Agents",
        level: 1,
      }),
    ).toBeVisible();
    await expect(
      await within(pageHeader).findByRole("button", {
        name: "Refresh agents",
      }),
    ).toBeVisible();
    await expect(
      within(pageHeader).queryByText(
        "Your registered agents in this community.",
      ),
    ).not.toBeInTheDocument();
    await expect(
      within(applicationHeader).queryByRole("heading", {
        name: "Agents",
        level: 1,
      }),
    ).not.toBeInTheDocument();
    await expect(
      within(applicationHeader).queryByRole("button", {
        name: "Refresh agents",
      }),
    ).not.toBeInTheDocument();
    const directory = await canvas.findByRole("region", {
      name: "Your agents",
    });
    await expect(
      within(directory).queryByRole("heading", { name: "Agents", level: 1 }),
    ).not.toBeInTheDocument();
    await expect(
      within(directory).queryByRole("button", { name: "Refresh agents" }),
    ).not.toBeInTheDocument();
    await expect(
      within(directory).getByText("Your registered agents in this community."),
    ).toBeVisible();
    await userEvent.click(
      await canvas.findByRole("button", { name: "View Research" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "View steve's profile" }),
    );
    await expect(
      canvas.findByRole("heading", { name: "steve" }),
    ).resolves.toBeVisible();
    await expect(
      canvas.queryByRole("article", { name: "Research agent profile" }),
    ).not.toBeInTheDocument();
    canvasElement.ownerDocument.defaultView!.history.back();
    await expect(
      canvas.findByRole("article", { name: "Research agent profile" }),
    ).resolves.toBeVisible();
  }}>{#snippet template()}<Harness />{/snippet}</Story
>

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
      canvas.getByRole("button", { name: "Open #general", exact: true }),
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
