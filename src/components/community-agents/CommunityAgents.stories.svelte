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
  name="Profile navigation"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Agents", exact: true }),
    ).toBeVisible();
    await expect(canvas.queryByRole("searchbox")).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("img", { name: "Research, Online" }),
    ).toBeVisible();
    await expect(
      canvas.queryByText("Online", { exact: true }),
    ).not.toBeInTheDocument();
    const card = canvas.getByRole("button", { name: "View Research" });
    card.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("article", { name: "Research agent profile" }),
    ).toBeVisible();
  }}>{#snippet template()}<Harness />{/snippet}</Story
>
<Story
  name="Gallery"
  play={async ({ canvas }) => {
    await expect(
      canvas.getAllByRole("button", { name: /^View / }),
    ).toHaveLength(3);
    for (const card of canvas.getAllByRole("button", { name: /^View / })) {
      const bounds = card.getBoundingClientRect();
      await expect(bounds.width / bounds.height).toBeCloseTo(0.8, 1);
      await expect(within(card).getByRole("img")).toHaveAttribute(
        "data-shape",
        "rounded",
      );
    }
  }}>{#snippet template()}<Harness variant="gallery" />{/snippet}</Story
>
<Story
  name="Card activity menu"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for Build" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("menuitem", { name: "Activity log" }));
    await expect(
      canvas.getByRole("region", { name: "Agent activity history" }),
    ).toBeVisible();
    const back = canvas.getByRole("button", { name: "Back to profile" });
    await waitFor(() =>
      expect(getComputedStyle(back).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(back);
    await expect(
      canvas.getByRole("article", { name: "Build agent profile" }),
    ).toBeVisible();
  }}>{#snippet template()}<Harness variant="gallery" />{/snippet}</Story
>
<Story name="Loading"
  >{#snippet template()}<Harness variant="loading" />{/snippet}</Story
>
<Story name="Empty"
  >{#snippet template()}<Harness variant="empty" />{/snippet}</Story
>
<Story
  name="Offline"
  play={async ({ canvas }) => {
    const avatar = canvas.getByRole("img", {
      name: "Research, Presence unknown",
    });
    await expect(
      avatar.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "unknown");
    await expect(
      canvas.queryByText("Presence unknown", { exact: true }),
    ).not.toBeInTheDocument();
  }}>{#snippet template()}<Harness variant="offline" />{/snippet}</Story
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
    const trigger = canvas.getByRole("button", {
      name: "Clear all saved activity",
    });
    await expect(trigger).toHaveAttribute("data-variant", "destructive");
    await waitFor(() =>
      expect(getComputedStyle(trigger).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    let dialog = body.getByRole("dialog", {
      name: "Clear all saved agent activity?",
    });
    await expect(
      canvas.queryByText("Saved history cleared"),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel", exact: true }),
    );
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
    await waitFor(() =>
      expect(getComputedStyle(trigger).pointerEvents).not.toBe("none"),
    );
    await expect(
      canvas.queryByText("Saved history cleared"),
    ).not.toBeInTheDocument();
    await userEvent.click(trigger);
    dialog = body.getByRole("dialog", {
      name: "Clear all saved agent activity?",
    });
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
  >{#snippet template()}<Harness narrow variant="gallery" />{/snippet}</Story
>
