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

<Story
  name="Profile processing controls"
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await canvas.findByRole("button", { name: "View Research" }),
    );
    const profile = within(
      await canvas.findByRole("article", { name: "Research agent profile" }),
    );
    const stop = await profile.findByRole("button", {
      name: "Stop",
      exact: true,
    });
    const sidebar = canvas.getByRole("complementary", {
      name: "Profile sidebar",
    });
    await waitFor(() =>
      expect(stop.getBoundingClientRect().right).toBeLessThanOrEqual(
        sidebar.getBoundingClientRect().right,
      ),
    );
    const message = profile.getByRole("button", {
      name: "Message",
      exact: true,
    });
    await expect(stop).toHaveAttribute(
      "data-variant",
      message.getAttribute("data-variant"),
    );
    await waitFor(() =>
      expect(stop.getBoundingClientRect().top).toBeCloseTo(
        message.getBoundingClientRect().top,
        0,
      ),
    );
    await userEvent.click(stop);
    await userEvent.click(body.getByRole("menuitem", { name: "Stop agent" }));
    await expect(
      profile.getByRole("button", { name: "Stopping…" }),
    ).toBeDisabled();
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Acknowledge processing change" }),
    );
    await userEvent.click(
      await profile.findByRole("button", { name: "Start", exact: true }),
    );
    await expect(body.getByText("Disabled", { exact: true })).toBeVisible();
    await userEvent.click(body.getByRole("menuitem", { name: "Start agent" }));
    await expect(
      profile.getByRole("button", { name: "Starting…" }),
    ).toBeDisabled();
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Acknowledge processing change" }),
    );
    await expect(
      await profile.findByRole("button", { name: "Stop", exact: true }),
    ).toBeVisible();
    await userEvent.click(
      profile.getByRole("button", { name: "Edit Research" }),
    );
    const editor = within(body.getByRole("dialog", { name: "Edit agent" }));
    await userEvent.type(
      editor.getByRole("combobox", { name: "Search community users" }),
      "Noor",
    );
    await userEvent.click(await editor.findByRole("option", { name: /Noor/ }));
    await expect(
      editor.getByRole("button", { name: "Remove Noor" }),
    ).toBeVisible();
    await userEvent.click(
      editor.getByRole("button", { name: "Cancel", exact: true }),
    );
  }}>{#snippet template()}<Harness manualProcessing />{/snippet}</Story
>

<Story
  name="Gallery avatar processing"
  play={async ({ canvas }) => {
    const view = await canvas.findByRole("button", { name: "View Research" });
    const cardElement = view.closest(".agents__card")!;
    const card = within(cardElement as HTMLElement);
    const stop = await card.findByRole("button", { name: "Stop", exact: true });
    const avatar = card.getByRole("img", { name: /Research/ });
    await waitFor(() => {
      const actionBounds = stop.getBoundingClientRect();
      const avatarBounds = avatar.getBoundingClientRect();
      expect(actionBounds.top).toBeLessThan(avatarBounds.bottom);
      expect(actionBounds.bottom).toBeGreaterThan(avatarBounds.bottom);
      expect(actionBounds.left + actionBounds.width / 2).toBeCloseTo(
        avatarBounds.left + avatarBounds.width / 2,
        0,
      );
    });
    await expect(card.getByText("Default model")).toBeVisible();
    await userEvent.click(stop);
    await expect(
      card.getByRole("button", { name: "Stopping…" }),
    ).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Acknowledge processing change" }),
    );
    await expect(
      await card.findByRole("button", { name: "Start", exact: true }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("article", { name: "Research agent profile" }),
    ).not.toBeInTheDocument();
  }}>{#snippet template()}<Harness manualProcessing />{/snippet}</Story
>
