<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import Harness from "../community-agents/CommunityAgentsStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Activity",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityAgentActivity } from "@lapismd/lapis-community/components";
<\/script>
<CommunityAgentActivity model={controller.state.agents} {rooms} onBack={openProfile} onSelectAgent={selectAgent} onSelectChannel={filterChannel} onLatest={refreshActivity} onLoadOlder={controller.actions.agents.loadOlderActivity} onClearHistory={clearSelectedHistory} />`,
        },
      },
    },
  });
</script>

<Story
  name="Timeline"
  play={async ({ canvas }) => {
    const timeline = canvas.getByRole("list", { name: "Agent event timeline" });
    const entries = within(timeline).getAllByRole("listitem");
    await expect(entries).toHaveLength(7);
    for (const entry of entries) {
      await expect(
        within(entry).getByRole("img", { name: /activity$/ }),
      ).toBeVisible();
      await expect(
        entry.querySelector('[data-ui-component="community-chip"]'),
      ).not.toBeInTheDocument();
      await expect(
        entry.querySelector('svg[aria-hidden="true"]'),
      ).toBeVisible();
      const time = entry.querySelector("time");
      await expect(time).toHaveTextContent(/minutes? ago/);
      await expect(time).toHaveAttribute("datetime");
      await expect(time).toHaveAttribute("title");
    }
    const time = entries[0]!.querySelector("time")!;
    await userEvent.hover(time);
    await expect(time).toHaveAttribute("aria-describedby");
    await userEvent.unhover(time);
    // Browser zoom can resolve a one-pixel rail to a fractional CSS pixel.
    await expect(
      parseFloat(getComputedStyle(timeline, "::before").width),
    ).toBeCloseTo(1, 1);
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>

<Story
  name="Events and older history"
  play={async ({ canvas }) => {
    for (const text of [
      "Here are the project updates.",
      "Read source",
      "Agent plan",
      "Agent error",
      "Turn finished",
      "custom status",
    ])
      await expect(canvas.getByText(text, { exact: true })).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Load older activity" }),
    );
    await expect(canvas.getByText("Earlier session")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Latest", exact: true }),
    );
    await expect(canvas.getByText("Showing latest activity")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to profile" }),
    );
    await expect(
      canvas.getByRole("article", { name: "Research agent profile" }),
    ).toBeVisible();
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>
<Story
  name="Channel filter"
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Activity agent" }),
    );
    await expect(
      body.getByRole("listbox", { name: "Activity agent" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        body.queryByRole("listbox", { name: "Activity agent" }),
      ).not.toBeInTheDocument(),
    );
    const channel = canvas.getByRole("button", { name: "Activity channel" });
    await waitFor(() =>
      expect(getComputedStyle(channel).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(channel);
    await expect(
      body.getByRole("listbox", { name: "Activity channel" }),
    ).toBeVisible();
    await userEvent.click(
      body.getByRole("option", {
        name: "# support",
      }),
    );
    await expect(canvas.getByText("No saved activity here yet")).toBeVisible();
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>
<Story
  name="Signer retry"
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("declined");
    await userEvent.click(
      canvas.getByRole("button", { name: "Latest", exact: true }),
    );
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(
      canvas.getByText("Here are the project updates."),
    ).toBeVisible();
  }}
  >{#snippet template()}<Harness
      screen="activity"
      variant="signer-error"
    />{/snippet}</Story
>
<Story name="Controller permission request"
  >{#snippet template()}<Harness
      screen="activity"
      variant="permission"
    />{/snippet}</Story
>
<Story
  name="Controller permissions"
  play={async ({ canvas, canvasElement }) => {
    const controls = canvas.getByRole("region", {
      name: "Agent runtime controls",
    });
    await expect(
      within(controls).getByText("Waiting for approval"),
    ).toBeVisible();
    await expect(within(controls).getByText("Run test suite")).toBeVisible();
    await expect(within(controls).getByText(/pnpm test/)).toBeVisible();
    await expect(
      within(controls).queryByRole("button", { name: "Always allow" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(controls).getByRole("button", { name: "Allow once" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "allow_once sent",
    );
    await expect(
      within(controls).queryByRole("article", {
        name: "Permission requested by Research",
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(controls).getByRole("button", { name: "Cancel turn" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Turn cancellation requested",
    );
    await userEvent.click(
      within(controls).getByRole("button", { name: "Reset conversation" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "alertdialog",
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Reset conversation",
        exact: true,
      }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Conversation reset requested",
    );
  }}
  >{#snippet template()}<Harness
      screen="activity"
      variant="permission"
    />{/snippet}</Story
>
<Story name="Storage failure"
  >{#snippet template()}<Harness
      screen="activity"
      variant="storage-error"
    />{/snippet}</Story
>
<Story name="Memory fallback"
  >{#snippet template()}<Harness
      screen="activity"
      variant="memory"
    />{/snippet}</Story
>
<Story name="Empty"
  >{#snippet template()}<Harness
      screen="activity"
      variant="empty"
    />{/snippet}</Story
>
<Story name="Narrow"
  >{#snippet template()}<Harness screen="activity" narrow />{/snippet}</Story
>
<Story
  name="Clear agent history"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("button", { name: "Clear this agent’s saved activity" }),
    ).toHaveAttribute("data-variant", "destructive");
    await userEvent.click(
      canvas.getByRole("button", { name: "Clear this agent’s saved activity" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "alertdialog",
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Clear history",
        exact: true,
      }),
    );
    await expect(canvas.getByText("No saved activity here yet")).toBeVisible();
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>
