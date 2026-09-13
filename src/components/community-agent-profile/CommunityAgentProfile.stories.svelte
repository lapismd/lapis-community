<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import CommunityAgentProfile from "./CommunityAgentProfile.svelte";
  import Harness from "../community-agents/CommunityAgentsStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Profile",
    component: CommunityAgentProfile,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityAgentProfile } from "@lapismd/lapis-community/components";
<\/script>
<CommunityAgentProfile {agent} {rooms} {canMessage} {ownerName} onOpenOwner={openOwnerProfile} onMessage={messageAgent} onFollow={followAgent} onActivity={openActivity} onCopy={copyKey} onOpenChannel={openChannel} onAddChannel={addToChannel} onRemoveChannel={removeFromChannel} onSaveAgent={saveAgent} onUnlinkPersona={unlinkPersona} onDeletePersona={deletePersona} />`,
        },
      },
    },
  });
</script>

<Story
  name="Info and owner profile"
  play={async ({ canvas }) => {
    const info = canvas.getByRole("list", { name: "Agent information" });
    for (const label of ["About", "Public key", "Managed by", "Agent type"]) {
      const row = within(info).getByText(label, { exact: true }).closest("li");
      await expect(row?.querySelector('svg[aria-hidden="true"]')).toBeVisible();
    }
    const activity = canvas.getByRole("button", { name: "Activity log" });
    await expect(
      within(activity).getByText("View", { exact: true }),
    ).toBeVisible();
    const avatar = canvas.getByRole("img", { name: "Research, Online" });
    await expect(
      avatar.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "online");
    await expect(
      canvas.queryByText("Online", { exact: true }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "View steve's profile" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Opened steve's profile",
    );
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Create persona"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Create persona", exact: true }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Create persona" });
    await expect(
      within(dialog).getByText(
        "Saved with the persona. A configured controller applies changes before the agent’s next idle turn.",
      ),
    ).toBeVisible();
    await userEvent.clear(within(dialog).getByLabelText("Persona name"));
    await userEvent.type(
      within(dialog).getByLabelText("Persona name"),
      "Research assistant",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save persona" }),
    );
    await expect(canvas.getByText("Persona research saved")).toBeVisible();
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Channels"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("tab", { name: "Channels", exact: true }),
    );
    await expect(
      canvas.getByRole("list", { name: "Agent channels" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Open #general" }),
    );
    await expect(canvas.getByText("Opened general")).toBeVisible();
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Runtime defaults"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Runtime" }));
    await expect(canvas.getByText("local-workspace")).toBeVisible();
    await expect(canvas.getByText("persona:release-notes:7")).toBeVisible();
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Model" }));
    await userEvent.click(body.getByRole("option", { name: "GPT-5.6" }));
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Save defaults" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Runtime defaults saved",
    );
    await expect(canvas.getByText("relay.issues.create")).toBeVisible();
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Memory review"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Memories" }));
    await expect(
      canvas.getByText("Summaries should lead with release blockers."),
    ).toBeVisible();
    await userEvent.click(canvas.getByText("Evidence (1)"));
    await expect(canvas.getByText(/^aaaaaaaaaaaa/u)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Approve" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Memory approved",
    );
    await expect(
      canvas.queryByText("Summaries should lead with release blockers."),
    ).not.toBeInTheDocument();
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Add to channel"
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("tab", { name: "Channels", exact: true }),
    );
    const trigger = canvas.getByRole("button", {
      name: "Add to channel",
      exact: true,
    });
    await userEvent.click(trigger);
    let dialog = body.getByRole("dialog", { name: "Add agent to channel" });
    const picker = within(dialog).getByRole("combobox", {
      name: "Search channels",
    });
    await waitFor(() => expect(picker).toHaveFocus());
    await expect(
      dialog.querySelector(
        '[data-ui-component="command-view"][data-ui-part="root"]',
      ),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole("button", {
        name: "Add to channel",
        exact: true,
      }),
    ).toBeDisabled();
    await userEvent.type(picker, "missing");
    await expect(
      within(dialog).getByText("No matching channels."),
    ).toBeVisible();
    await userEvent.clear(picker);
    await userEvent.type(picker, "support");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      within(dialog).getByText("Selected channel: #support"),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole("button", {
        name: "Add to channel",
        exact: true,
      }),
    ).toBeEnabled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Copy public key" }),
    );
    await expect(
      within(dialog).getByRole("button", { name: "Copied", exact: true }),
    ).toBeVisible();
    const close = within(dialog).getByRole("button", {
      name: "Close add agent dialog",
    });
    await expect(close.querySelector("svg")).toHaveClass("size-3.5");
    await userEvent.click(close);
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none");
    });
    await userEvent.click(trigger);
    dialog = body.getByRole("dialog", { name: "Add agent to channel" });
    await expect(
      within(dialog).getByRole("combobox", { name: "Search channels" }),
    ).toHaveValue("");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel", exact: true }),
    );
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none");
    });
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Message follow and activity"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Message", exact: true }),
    );
    await expect(
      canvas.getByText("Conversation with Research opened"),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Follow", exact: true }),
    );
    await expect(
      canvas.getByRole("button", { name: "Unfollow", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      canvas.getByRole("button", { name: "Copy Research's public key" }),
    );
    await expect(canvas.getByText("Public key copied")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Activity log" }));
    await expect(
      canvas.getByText("Here are the project updates."),
    ).toBeVisible();
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>
<Story
  name="Channel membership failure and retry"
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("tab", { name: "Channels", exact: true }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Add to channel" }),
    );
    let dialog = body.getByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("combobox", { name: "Search channels" }),
      "support",
    );
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(
      within(dialog).getByText("Selected channel: #support"),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Add to channel",
        exact: true,
      }),
    );
    await expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Relay denied",
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Add to channel",
        exact: true,
      }),
    );
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none");
    });
    await expect(
      canvas.getByRole("button", { name: "Open #support", exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for support" }),
    );
    await expect(
      body.getByRole("menu").getBoundingClientRect().width,
    ).toBeGreaterThanOrEqual(190);
    await userEvent.click(
      body.getByRole("menuitem", { name: "Remove", exact: true }),
    );
    dialog = body.getByRole("alertdialog");
    await expect(
      within(dialog).getByRole("heading", {
        name: "Remove Research from support?",
      }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none");
    });
    await expect(
      canvas.getByRole("button", { name: "Open #support", exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Actions for support" }),
    );
    await userEvent.click(
      body.getByRole("menuitem", { name: "Remove", exact: true }),
    );
    await userEvent.click(
      within(body.getByRole("alertdialog")).getByRole("button", {
        name: "Remove agent",
        exact: true,
      }),
    );
    await expect(
      canvas.queryByRole("button", { name: "Open #support", exact: true }),
    ).not.toBeInTheDocument();
  }}
  >{#snippet template()}<Harness screen="profile" failAction />{/snippet}</Story
>
<Story
  name="Follow publication failure"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Follow", exact: true }),
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent("Relay denied");
    await expect(
      canvas.getByRole("button", { name: "Follow", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  }}
  >{#snippet template()}<Harness screen="profile" failAction />{/snippet}</Story
>
<Story
  name="Encryption unavailable"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Message", exact: true }),
    ).toBeDisabled();
    await expect(
      canvas.getByText(
        "Connect a signer with encryption support to message this agent.",
      ),
    ).toBeVisible();
  }}
  >{#snippet template()}<Harness
      screen="profile"
      variant="no-encryption"
    />{/snippet}</Story
>
<Story
  name="Permission denied"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("tab", { name: "Channels", exact: true }),
    );
    await expect(
      canvas.getByRole("button", { name: "Add to channel" }),
    ).toBeDisabled();
    await expect(
      canvas.queryByRole("button", { name: "Actions for general" }),
    ).not.toBeInTheDocument();
  }}
  >{#snippet template()}<Harness
      screen="profile"
      variant="denied"
    />{/snippet}</Story
>
<Story name="Offline narrow"
  >{#snippet template()}<Harness
      screen="profile"
      variant="offline"
      narrow
    />{/snippet}</Story
>

<Story
  name="Profile action feedback"
  play={async ({ canvas }) => {
    // CSS :hover needs a real pointer. Storybook's synthetic userEvent only
    // dispatches events; use the browser provider in the automated acceptance lane.
    const pointer =
      import.meta.env.MODE === "test"
        ? (await import("vitest/browser")).userEvent
        : undefined;
    for (const name of ["Message", "Follow"]) {
      const button = canvas.getByRole("button", { name, exact: true });
      if (pointer) await pointer.unhover(button);
      const idle = getComputedStyle(button).boxShadow;
      if (pointer) {
        await pointer.hover(button);
        await expect(button.matches(":hover")).toBe(true);
        await waitFor(() =>
          expect(getComputedStyle(button).boxShadow).not.toBe(idle),
        );
        await pointer.unhover(button);
      }
      button.focus();
      await expect(button).toHaveFocus();
      await expect(getComputedStyle(button).boxShadow).not.toBe(idle);
      button.blur();
    }
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>
