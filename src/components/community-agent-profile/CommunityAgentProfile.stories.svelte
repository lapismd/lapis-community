<script module lang="ts">
  import { playProfileEditor } from "./profile-editor-story.js";
  import { profileActionFeedback } from "../../testing/profile-action-feedback.js";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within, waitFor } from "storybook/test";
  import CommunityAgentProfile from "./CommunityAgentProfile.svelte";
  import Harness from "../community-agents/CommunityAgentsStoryHarness.svelte";
  import { storyBootstrapRevision } from "../community-agents/runtime-story-fixtures.js";
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
<CommunityAgentProfile {agent} {rooms} {members} {memberResults} {onSearchMembers} {processing} onLoadProcessing={loadProcessing} onSetProcessing={setProcessing} {canMessage} {ownerName} onOpenOwner={openOwnerProfile} onMessage={messageAgent} onFollow={followAgent} onActivity={openActivity} onCopy={copyKey} onOpenChannel={openChannel} onAddChannel={addToChannel} onRemoveChannel={removeFromChannel} onSaveAgent={saveAgent} />`,
        },
      },
    },
  });
</script>

<Story
  name="Info and owner profile"
  play={async ({ canvas }) => {
    const info = canvas.getByRole("list", { name: "Agent information" });
    const working = canvas.getByText("Working");
    expect(
      working.closest('[data-ui-component="ai-chat-reasoning"]'),
    ).toHaveAttribute("data-streaming", "true");
    await expect(
      canvas.queryByRole("heading", { name: "Info" }),
    ).not.toBeInTheDocument();
    await expect(canvas.queryByText("Persona nyra")).not.toBeInTheDocument();
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
    await expect(canvas.getByText("Opened steve's profile")).toBeVisible();
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story name="Edit agent" play={playProfileEditor}
  >{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Avatar edit affordance"
  play={async ({ canvas, canvasElement }) => {
    const editAgent = canvas.getByRole("button", {
      name: "Edit Research",
      exact: true,
    });
    await expect(
      canvas.queryByText("Edit agent", { exact: true }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("img", { name: "Research, Online" }),
    ).toHaveAttribute("data-shape", "rounded");
    const overlay = editAgent.querySelector(".agent-profile__name-edit-icon");
    await expect(overlay).toBeInTheDocument();
    await userEvent.click(editAgent);
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    await expect(dialog).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
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
    const copyBootstrap = canvas.getByRole("button", {
      name: `Copy full bootstrap revision: ${storyBootstrapRevision}`,
    });
    await expect(copyBootstrap).toHaveTextContent("a5b62844…7e18");
    await expect(
      canvas.queryByText(storyBootstrapRevision),
    ).not.toBeInTheDocument();
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(
      globalThis.navigator,
      "clipboard",
    );
    const writeText = fn(async () => undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      await userEvent.click(copyBootstrap);
      await waitFor(() =>
        expect(writeText).toHaveBeenCalledWith(storyBootstrapRevision),
      );
      await expect(copyBootstrap).toHaveAttribute("data-copied", "true");
    } finally {
      if (clipboardDescriptor) {
        Object.defineProperty(
          globalThis.navigator,
          "clipboard",
          clipboardDescriptor,
        );
      } else {
        Reflect.deleteProperty(globalThis.navigator, "clipboard");
      }
    }
    await expect(
      canvas.getByRole("button", { name: "Refresh runtime details" }),
    ).toBeVisible();
    await expect(
      getComputedStyle(
        canvas.getByText(
          "/Users/operator/.lapis/community/agents/0123456789abcdef/workspace",
        ),
      ).overflowWrap,
    ).toBe("anywhere");
    const runtimeDefaults = canvasElement.querySelector(
      `[data-ui-part="runtime-defaults"]`,
    );
    await expect(runtimeDefaults).toBeVisible();
    await expect(canvas.getByText("Agent configuration")).toBeVisible();
    await expect(canvas.getByText("Agent harness")).toBeVisible();
    await expect(canvas.getByText("Model")).toBeVisible();
    await expect(canvas.getByText("Thinking")).toBeVisible();
    const tools = canvasElement.querySelector(`[data-ui-part="runtime-tools"]`);
    await expect(tools).toBeVisible();
    await expect(getComputedStyle(tools!).borderTopWidth).toBe("1px");
    await expect(
      canvas.queryByText("Edit agent", { exact: true }),
    ).not.toBeInTheDocument();
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Edit model" }));
    const dialog = body.getByRole("dialog", { name: "Edit agent" });
    await expect(
      within(dialog).getByText("AI configuration", { exact: true }),
    ).toBeVisible();
    await expect(
      within(dialog).getByRole("tab", { name: "Use harness defaults" }),
    ).toBeVisible();
    await expect(within(dialog).getByText("Harness")).toBeVisible();
    await expect(within(dialog).getByText("Codex")).toBeVisible();
    await expect(within(dialog).getByText("GPT-6")).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("tab", { name: "Customize for this agent" }),
    );
    await expect(
      within(dialog).getByRole("combobox", { name: "Search models" }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );
    await expect(canvas.getByText("Runtime defaults saved")).toBeVisible();
    const toolsTrigger = canvas.getByRole("button", { name: "Tools" });
    await waitFor(() =>
      expect(getComputedStyle(toolsTrigger).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(toolsTrigger);
    await expect(canvas.getByText("relay.issues.create")).toBeVisible();
  }}>{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Memory review"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Memories" }));
    await expect(
      canvas.getByRole("button", { name: "Filter memories" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Filter memories" }),
    );
    await expect(
      canvas.queryByRole("button", { name: "Search" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Choose memory channel" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Choose memory status" }),
    ).toBeVisible();
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      canvas.queryByRole("combobox", { name: "Choose memory channel" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Choose memory channel" }),
    );
    await expect(body.getByPlaceholderText("Search channels...")).toBeVisible();
    await expect(
      body
        .getAllByText("#general")
        .find((node) =>
          node.classList.contains("ui-filter-command-picker__item-label"),
        ),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      canvas.getByRole("button", { name: "Choose memory status" }),
    );
    await expect(body.getByPlaceholderText("Search statuses...")).toBeVisible();
    await expect(
      body
        .getAllByText("Needs review")
        .find((node) =>
          node.classList.contains("ui-filter-command-picker__item-label"),
        ),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search memories" }),
      "release",
    );
    await waitFor(() => {
      expect(
        canvas.getByText("Summaries should lead with release blockers."),
      ).toBeVisible();
    });
    const evidence = canvas.getByText("Evidence (1)").closest("summary");
    await expect(evidence?.querySelector("svg")).toBeVisible();
    await userEvent.click(canvas.getByText("Evidence (1)"));
    await expect(canvas.getByText(/^aaaaaaaaaaaa/u)).toBeVisible();
    const reviewActions = canvas.getByRole("group", {
      name: "Review preference memory",
    });
    await expect(reviewActions.querySelectorAll("svg")).toHaveLength(2);
    await userEvent.click(
      within(reviewActions).getByRole("button", { name: "Approve" }),
    );
    await expect(canvas.getByText("Memory approved")).toBeVisible();
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
  play={(context) =>
    profileActionFeedback(context, import.meta.env.MODE === "test")}
  >{#snippet template()}<Harness screen="profile" />{/snippet}</Story
>

<Story
  name="Project channel selection"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("tab", { name: "Channels", exact: true }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Add to channel", exact: true }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "dialog",
      { name: "Add agent to channel" },
    );
    const room = within(dialog).getByRole("option", { name: /^support/u });
    await expect(
      room.querySelector('[data-ui-part="project-channel-icon"]'),
    ).toBeVisible();
    await userEvent.click(room);
    await expect(
      within(dialog).getByText("Selected channel: #support"),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close add agent dialog" }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  }}
  >{#snippet template()}<Harness
      screen="profile"
      projectChannels
    />{/snippet}</Story
>
