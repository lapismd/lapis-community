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
<CommunityAgents model={controller.state.agents} onProfile={openProfile} onActivity={openActivity} onSaveAgent={controller.actions.agents.saveAgent} onRefresh={controller.actions.agents.refresh} onClearHistory={() => controller.actions.agents.clearHistory()} />`,
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
    await expect(
      canvas.getByRole("button", { name: "Add agent" }),
    ).toBeVisible();
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
  }}>{#snippet template()}<Harness variant="gallery" />{/snippet}</Story
>
<Story
  name="Add agent"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add agent" }));
    const body = within(canvasElement.ownerDocument.body);
    let dialog = body.getByRole("dialog", { name: "Add agent" });
    await expect(
      within(dialog).getByRole("group", { name: "Agent instructions" }),
    ).toBeVisible();
    const imageButton = within(dialog).getByRole("button", {
      name: "Choose agent image",
    });
    await userEvent.click(imageButton);
    const imagePicker = body.getByLabelText("Avatar image picker");
    await expect(imagePicker).toBeVisible();
    expect(
      imagePicker.getBoundingClientRect().top -
        imageButton.getBoundingClientRect().bottom,
    ).toBeCloseTo(12, 0);
    await userEvent.click(
      within(imagePicker).getByRole("tab", { name: "Emoji" }),
    );
    await expect(
      within(imagePicker).getByRole("button", {
        name: "Browse all emoji",
      }),
    ).toBeVisible();
    await userEvent.click(
      body.getByRole("button", { name: "Browse all emoji" }),
    );
    const emoji = await waitFor(() => {
      const button = canvasElement.ownerDocument
        .querySelector("em-emoji-picker")
        ?.shadowRoot?.querySelector<HTMLButtonElement>(
          'button[aria-label="🤣"]',
        );
      expect(button).not.toBeNull();
      return button!;
    });
    await userEvent.click(emoji);
    expect(
      decodeURIComponent(
        within(dialog)
          .getByRole("img", { name: "Selected avatar" })
          .getAttribute("src")!,
      ),
    ).toContain("🤣");
    if (body.queryByLabelText("Avatar image picker")) {
      await userEvent.keyboard("{Escape}");
    }
    const scrollArea = dialog.querySelector<HTMLElement>(
      '[data-ui-component="scroll-area"][data-ui-part="scroll-area"]',
    );
    const scrollbar = dialog.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-scrollbar"]',
    );
    const footer = dialog.querySelector<HTMLElement>(
      '[data-slot="dialog-footer"]',
    );
    expect(scrollArea).not.toBeNull();
    expect(scrollbar).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(scrollbar!.getBoundingClientRect().right).toBeCloseTo(
      scrollArea!.getBoundingClientRect().right,
      0,
    );
    // Exercise overflow even when the test runner has a tall viewport.
    dialog.style.maxHeight = "32rem";
    await waitFor(() =>
      expect(dialog.getBoundingClientRect().height).toBeLessThanOrEqual(512),
    );
    const footerTop = footer!.getBoundingClientRect().top;
    const viewport = scrollArea!.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    );
    expect(viewport).not.toBeNull();
    expect(viewport!.scrollHeight).toBeGreaterThan(viewport!.clientHeight);
    viewport!.scrollTop = viewport!.scrollHeight;
    await waitFor(() => expect(viewport!.scrollTop).toBeGreaterThan(0));
    expect(footer!.getBoundingClientRect().top).toBeCloseTo(footerTop, 0);
    await expect(
      within(dialog).getByLabelText("Agent public key"),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add agent" }),
    );
    await expect(
      within(dialog).getByText("Enter a valid hex or npub public key."),
    ).toBeVisible();
    await userEvent.type(
      within(dialog).getByLabelText("Agent public key"),
      "f".repeat(64),
    );
    await userEvent.type(within(dialog).getByLabelText("Persona name"), "Fizz");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add agent" }),
    );
    await expect(canvas.getByText("Persona fizz saved")).toBeVisible();
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getByRole("button", { name: "Add agent" }),
    ).toHaveFocus();
  }}>{#snippet template()}<Harness variant="gallery" />{/snippet}</Story
>
<Story
  name="Use saved persona"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Add agent" }));
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole("dialog", { name: "Add agent" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Use saved persona" }),
    );
    await expect(within(dialog).getAllByText("Release notes")[0]).toBeVisible();
    await userEvent.type(
      within(dialog).getByLabelText("Agent public key"),
      "e".repeat(64),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add agent" }),
    );
    await expect(canvas.getByText("Persona release-notes saved")).toBeVisible();
  }}>{#snippet template()}<Harness variant="gallery" />{/snippet}</Story
>
<Story
  name="Delete persona"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete persona Release notes" }),
    );
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
  }}>{#snippet template()}<Harness variant="gallery" />{/snippet}</Story
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
  }}>{#snippet template()}<Harness variant="loading" />{/snippet}</Story
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
  }}>{#snippet template()}<Harness failAction />{/snippet}</Story
>
<Story name="Narrow gallery"
  >{#snippet template()}<Harness narrow variant="gallery" />{/snippet}</Story
>
