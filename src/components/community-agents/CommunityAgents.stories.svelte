<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityAgents from "./CommunityAgents.svelte";
  import Harness from "./CommunityAgentsStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Directory",
    component: CommunityAgents,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityAgents } from "@lapismd/lapis-community/components";
<\/script>
<CommunityAgents model={controller.state.agents} onProfile={openProfile} onActivity={openActivity} onRefresh={controller.actions.agents.refresh} onClearHistory={() => controller.actions.agents.clearHistory()} />`,
        },
      },
    },
  });
</script>

<Story
  name="Search and profile"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Agents", exact: true }),
    ).toBeVisible();
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search your agents" }),
      "missing",
    );
    await expect(canvas.getByText("No agents match “missing”.")).toBeVisible();
    await userEvent.clear(
      canvas.getByRole("searchbox", { name: "Search your agents" }),
    );
    const card = canvas.getByRole("button", { name: "View Research" });
    card.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("article", { name: "Research agent profile" }),
    ).toBeVisible();
  }}>{#snippet template()}<Harness />{/snippet}</Story
>
<Story name="Loading"
  >{#snippet template()}<Harness variant="loading" />{/snippet}</Story
>
<Story name="Empty"
  >{#snippet template()}<Harness variant="empty" />{/snippet}</Story
>
<Story name="Offline"
  >{#snippet template()}<Harness variant="offline" />{/snippet}</Story
>
<Story
  name="Partial results"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Refresh agents" }),
    );
    await expect(canvas.getByText("Agent directory refreshed")).toBeVisible();
  }}>{#snippet template()}<Harness variant="partial" />{/snippet}</Story
>
<Story
  name="Discovery failure"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("Agent discovery failed. Refresh to retry."),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Refresh agents" }),
    );
    await expect(canvas.getByText("Agent directory refreshed")).toBeVisible();
  }}>{#snippet template()}<Harness variant="error" />{/snippet}</Story
>
<Story
  name="Historical agent"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Research Historical" }),
    );
    await expect(
      canvas.getByRole("region", { name: "Agent activity history" }),
    ).toBeVisible();
  }}>{#snippet template()}<Harness variant="historical" />{/snippet}</Story
>
<Story
  name="Confirmed clear failure and retry"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Clear all saved activity" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Clear history",
        exact: true,
      }),
    );
    await expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Relay denied",
    );
    const close = within(dialog).getByRole("button", {
      name: "Close clear history dialog",
    });
    await expect(close.querySelector("svg")).toHaveClass("size-3.5");
    await userEvent.hover(close);
    close.focus();
    await expect(close).toHaveFocus();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Clear history",
        exact: true,
      }),
    );
    await expect(canvas.getByText("Saved history cleared")).toBeVisible();
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  }}>{#snippet template()}<Harness failAction />{/snippet}</Story
>
<Story name="Narrow gallery"
  >{#snippet template()}<Harness narrow />{/snippet}</Story
>
