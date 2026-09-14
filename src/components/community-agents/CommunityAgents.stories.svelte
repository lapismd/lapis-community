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
      communityAppShell: true,
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { AppShell } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import { CommunityAgents } from "@lapismd/lapis-community/components";
<\/script>
<AppShell.Toolbar label="Agents page header">
  <h1>Agents</h1>
  <Button variant="ghost" size="icon-sm" aria-label="Refresh agents" onclick={controller.actions.agents.refresh}>
    <RefreshIcon aria-hidden="true" />
  </Button>
</AppShell.Toolbar>
<AppShell.Body layout="regions" label="Agents">
  <AppShell.Body.Content label="Agents directory">
    <CommunityAgents model={controller.state.agents} onProfile={openProfile} onActivity={openActivity} onSaveAgent={controller.actions.agents.saveAgent} onRefresh={controller.actions.agents.refresh} onClearHistory={() => controller.actions.agents.clearHistory()} showPageHeader={false} showBodyDescription />
  </AppShell.Body.Content>
</AppShell.Body>`,
        },
      },
    },
  });
</script>

<Story
  name="Profile navigation"
  play={async ({ canvas }) => {
    const pageHeader = canvas.getByLabelText("Agents page header");
    const directory = canvas.getByRole("region", { name: "Your agents" });
    await expect(
      within(pageHeader).getByRole("heading", { name: "Agents", exact: true }),
    ).toBeVisible();
    const refresh = within(pageHeader).getByRole("button", {
      name: "Refresh agents",
    });
    await expect(refresh).toHaveTextContent("");
    await expect(
      within(directory).queryByRole("heading", { name: "Agents", exact: true }),
    ).not.toBeInTheDocument();
    await expect(
      within(directory).getByText("Your registered agents in this community."),
    ).toBeVisible();
    await expect(canvas.queryByRole("searchbox")).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("img", { name: "Research, Online" }),
    ).toBeVisible();
    await expect(
      canvas.queryByText("Online", { exact: true }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Add agent" }),
    ).toBeVisible();
    const card = canvas.getByRole("button", { name: "View Research" });
    card.focus();
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("article", { name: "Research agent profile" }),
    ).toBeVisible();
  }}>{#snippet template()}<Harness appShell />{/snippet}</Story
>
<Story
  name="Gallery"
  play={async ({ canvas }) => {
    await expect(
      canvas.getAllByRole("button", { name: /^View / }),
    ).toHaveLength(3);
    const addCard = canvas.getByRole("button", { name: "Add agent" });
    await expect(addCard).toBeVisible();
    expect(
      addCard.compareDocumentPosition(
        canvas.getByRole("button", { name: "View Research" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const card of canvas.getAllByRole("button", { name: /^View / })) {
      const bounds = card.getBoundingClientRect();
      await expect(bounds.width / bounds.height).toBeCloseTo(0.8, 1);
      await expect(within(card).getByRole("img")).toHaveAttribute(
        "data-shape",
        "rounded",
      );
    }
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story
  name="Add agent"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add agent" }));
    const body = within(canvasElement.ownerDocument.body);
    let dialog = body.getByRole("dialog", { name: "Create managed agent" });
    await expect(
      within(dialog).queryByLabelText("Agent public key"),
    ).not.toBeInTheDocument();
    await expect(
      within(dialog).getByText(/agent secret stays encrypted/i),
    ).toBeVisible();
    await userEvent.type(within(dialog).getByLabelText("Persona name"), "Fizz");
    const channelPicker = within(dialog).getByRole("combobox", {
      name: "Search channels",
    });
    await expect(
      dialog.querySelector(
        '[data-ui-component="command-view"][data-ui-part="root"]',
      ),
    ).toBeVisible();
    await userEvent.type(channelPicker, "general");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      within(dialog).getByText(/1 channel selected: #general/i),
    ).toBeVisible();
    const createButtons = within(dialog).getAllByRole("button", {
      name: "Create managed agent",
    });
    await userEvent.click(createButtons.at(-1)!);
    dialog = await body.findByRole("dialog", { name: "Controller setup" });
    await expect(within(dialog).getByText(/held by this relay/i)).toBeVisible();
    await expect(
      within(dialog).getByRole("button", { name: "Copy" }),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole("button", { name: "Download" }),
    ).toBeVisible();
    await expect(
      within(dialog).getByText(/"lapis.agent-controller-bootstrap\/1"/),
    ).toBeVisible();
    await expect(within(dialog).getByText(/"group-general"/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story
  name="Link existing agent"
  play={async ({ canvas, canvasElement }) => {
    const addAgent = canvas.getByRole("button", { name: "Add agent" });
    await waitFor(() =>
      expect(getComputedStyle(addAgent).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(addAgent);
    const body = within(canvasElement.ownerDocument.body);
    let dialog = body.getByRole("dialog", { name: "Create managed agent" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Link existing agent" }),
    );
    dialog = body.getByRole("dialog", { name: "Link existing agent" });
    await userEvent.type(
      within(dialog).getByLabelText("Agent public key"),
      "f".repeat(64),
    );
    await userEvent.type(within(dialog).getByLabelText("Persona name"), "Fizz");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Link agent" }),
    );
    await expect(canvas.getByText("Persona fizz saved")).toBeVisible();
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story
  name="Managed agents unavailable"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add agent" }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Link existing agent" });
    await expect(
      within(dialog).getByRole("button", { name: "Create managed agent" }),
    ).toBeDisabled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close add agent dialog" }),
    );
  }}
  >{#snippet template()}<Harness
      variant="unsupported-managed"
      appShell
    />{/snippet}</Story
>
<Story
  name="Managed creation retry"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add agent" }));
    const body = within(canvasElement.ownerDocument.body);
    let dialog = body.getByRole("dialog", { name: "Create managed agent" });
    await userEvent.type(within(dialog).getByLabelText("Persona name"), "Fizz");
    let buttons = within(dialog).getAllByRole("button", {
      name: "Create managed agent",
    });
    await userEvent.click(buttons.at(-1)!);
    await expect(
      within(dialog).getByText(/Relay denied the request/i),
    ).toBeVisible();
    buttons = within(dialog).getAllByRole("button", {
      name: "Create managed agent",
    });
    await userEvent.click(buttons.at(-1)!);
    dialog = await body.findByRole("dialog", { name: "Controller setup" });
    await expect(within(dialog).getByText(/held by this relay/i)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  }}
  >{#snippet template()}<Harness
      variant="gallery"
      failAction
      appShell
    />{/snippet}</Story
>
<Story
  name="Partial room access"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add agent" }));
    const body = within(canvasElement.ownerDocument.body);
    let dialog = body.getByRole("dialog", { name: "Create managed agent" });
    await userEvent.type(within(dialog).getByLabelText("Persona name"), "Fizz");
    const channelPicker = within(dialog).getByRole("combobox", {
      name: "Search channels",
    });
    await userEvent.type(channelPicker, "general");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await userEvent.clear(channelPicker);
    await userEvent.type(channelPicker, "support");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      within(dialog).getByText(/2 channels selected: #general, #support/i),
    ).toBeVisible();
    const buttons = within(dialog).getAllByRole("button", {
      name: "Create managed agent",
    });
    await userEvent.click(buttons.at(-1)!);
    dialog = await body.findByRole("dialog", { name: "Controller setup" });
    await expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "support",
    );
    await expect(within(dialog).getByText(/"group-general"/)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  }}
  >{#snippet template()}<Harness
      appShell
      variant="room-failure"
    />{/snippet}</Story
>
<Story
  name="Edit agent"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for Research" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const edit = body.getByRole("menuitem", { name: "Edit agent" });
    await expect(edit.querySelector("svg")).toBeVisible();
    await userEvent.click(edit);
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    await expect(
      within(dialog).getByText("Agent instructions", { exact: true }),
    ).toBeVisible();
    await expect(
      within(dialog).getByText("AI configuration", { exact: true }),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole("tab", { name: "Use harness defaults" }),
    ).toBeVisible();
    await expect(within(dialog).getByText("Harness")).toBeVisible();
    await expect(within(dialog).getByText("Codex")).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Customize for this agent" }),
    );
    await expect(
      within(dialog).getByRole("button", { name: "Agent harness" }),
    ).toBeVisible();
    await userEvent.clear(within(dialog).getByLabelText("Agent name"));
    await userEvent.type(within(dialog).getByLabelText("Agent name"), "Scout");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await expect(canvas.getByText("Runtime defaults saved")).toBeVisible();
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story
  name="Replacement controller setup"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for Research" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      body.getByRole("menuitem", { name: "Create replacement setup" }),
    );
    const dialog = await body.findByRole("dialog", {
      name: "Controller setup",
    });
    await expect(within(dialog).getByText(/held by this relay/i)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story
  name="Revoke controller access"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for Research" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const revoke = body.getByRole("menuitem", {
      name: "Revoke controller access",
    });
    await expect(revoke.querySelector("svg")).toBeVisible();
    await userEvent.click(revoke);
    const dialog = body.getByRole("alertdialog", {
      name: "Revoke controller access?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Revoke access" }),
    );
    await expect(canvas.getByText("Controller access revoked.")).toBeVisible();
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story
  name="Delete managed agent"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for Research" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(body.getByRole("menuitem", { name: "Delete" }));
    const dialog = body.getByRole("alertdialog", {
      name: "Delete this managed agent?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete managed agent" }),
    );
    await expect(canvas.getByText("Managed agent deleted.")).toBeVisible();
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story name="Managed agents narrow"
  >{#snippet template()}<Harness
      appShell
      narrow
      variant="gallery"
    />{/snippet}</Story
>
<Story name="Managed agents dark" globals={{ colorMode: "dark" }}
  >{#snippet template()}<Harness
      appShell
      variant="no-archive"
    />{/snippet}</Story
>
<Story
  name="Delete persona"
  play={async ({ canvas, canvasElement }) => {
    const deletePersona = canvas.getByRole("button", {
      name: "Delete persona Release notes",
    });
    await waitFor(() =>
      expect(getComputedStyle(deletePersona).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(deletePersona);
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("alertdialog", {
      name: "Delete this persona?",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete persona" }),
    );
    await expect(
      canvas.getByText("Persona release-notes deleted"),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Delete persona Release notes" }),
    ).not.toBeInTheDocument();
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story
  name="Edit saved persona"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Edit persona Release notes" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Edit persona" });
    const name = within(dialog).getByLabelText("Persona name");
    await userEvent.clear(name);
    await userEvent.type(name, "Release editor");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save persona" }),
    );
    await expect(canvas.getByText("Persona release-notes saved")).toBeVisible();
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
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
  }}
  >{#snippet template()}<Harness appShell variant="gallery" />{/snippet}</Story
>
<Story
  name="Loading"
  play={async ({ canvasElement, canvas }) => {
    expect(
      canvas.getByRole("status", { name: "Loading your agents" }),
    ).toHaveAttribute("data-layout", "gallery");
    expect(
      canvasElement.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(4);
    expect(
      canvas.queryByRole("button", { name: "View Research" }),
    ).not.toBeInTheDocument();
  }}
  >{#snippet template()}<Harness appShell variant="loading" />{/snippet}</Story
>
<Story
  name="Empty"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Add agent" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("region", { name: "Saved personas" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "New persona" }),
    ).not.toBeInTheDocument();
  }}>{#snippet template()}<Harness appShell variant="empty" />{/snippet}</Story
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
  }}
  >{#snippet template()}<Harness appShell variant="offline" />{/snippet}</Story
>
<Story
  name="Partial results"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Refresh agents" }),
    );
    await expect(canvas.getByText("Agent directory refreshed")).toBeVisible();
  }}
  >{#snippet template()}<Harness appShell variant="partial" />{/snippet}</Story
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
  }}>{#snippet template()}<Harness appShell variant="error" />{/snippet}</Story
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
  }}
  >{#snippet template()}<Harness
      appShell
      variant="historical"
    />{/snippet}</Story
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
    let dialog = body.getByRole("alertdialog", {
      name: "Clear all saved agent activity?",
    });
    await expect(
      canvas.queryByText("Saved history cleared"),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel", exact: true }),
    );
    await waitFor(() =>
      expect(body.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    await expect(trigger).toHaveFocus();
    await waitFor(() =>
      expect(getComputedStyle(trigger).pointerEvents).not.toBe("none"),
    );
    await expect(
      canvas.queryByText("Saved history cleared"),
    ).not.toBeInTheDocument();
    await userEvent.click(trigger);
    dialog = body.getByRole("alertdialog", {
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
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Clear history",
        exact: true,
      }),
    );
    await expect(canvas.getByText("Saved history cleared")).toBeVisible();
    await waitFor(() =>
      expect(body.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  }}>{#snippet template()}<Harness appShell failAction />{/snippet}</Story
>
<Story name="Narrow gallery"
  >{#snippet template()}<Harness
      appShell
      narrow
      variant="gallery"
    />{/snippet}</Story
>
