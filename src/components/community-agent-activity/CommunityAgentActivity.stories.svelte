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
    await userEvent.click(
      canvas.getByRole("button", { name: "Clear this agent’s saved activity" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Clear history",
        exact: true,
      }),
    );
    await expect(canvas.getByText("No saved activity here yet")).toBeVisible();
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>
