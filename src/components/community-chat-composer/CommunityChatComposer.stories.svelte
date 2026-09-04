<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import {
    expect,
    fireEvent,
    fn,
    userEvent,
    waitFor,
    within,
  } from "storybook/test";

  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  import CommunityChatComposerStoryHarness from "./CommunityChatComposerStoryHarness.svelte";
  import type {
    CommunityComposerDraftStore,
    CommunityMessageMediaAdapter,
  } from "./model.js";
  import {
    communityComposerStoryEmojis,
    communityComposerStoryImage,
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "./story-fixtures.js";

  const commonArgs = {
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    currentMemberId: "ada",
    onSubmit: fn(),
  };

  const mediaAdapter: CommunityMessageMediaAdapter = {
    upload(file, { signal, onProgress }) {
      return new Promise((resolve, reject) => {
        onProgress(22);
        const progressTimeout = window.setTimeout(() => onProgress(68), 80);
        const completionTimeout = window.setTimeout(() => {
          if (file.name.startsWith("failed")) {
            reject(new Error("Upload interrupted — try again"));
            return;
          }
          resolve({
            url: communityComposerStoryImage,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            sha256: "storybook-media-sha256",
            name: file.name,
          });
        }, 180);
        signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(progressTimeout);
            window.clearTimeout(completionTimeout);
            reject(new DOMException("Upload cancelled", "AbortError"));
          },
          { once: true },
        );
      });
    },
  };

  const draftStore: CommunityComposerDraftStore = {
    async load() {
      return {
        value:
          "Draft restored locally for @Mara Chen in #plugin-development.\n\n- Confirm the relay fixture\n- Capture the Storybook state",
        mentionPubkeys: ["mara"],
        channelIds: ["plugin-development"],
        attachments: [],
        updatedAt: Date.now() - 42_000,
      };
    },
    save: fn(async () => {}),
    remove: fn(async () => {}),
  };

  const { Story } = defineMeta({
    title: "Community/Channels/Chat Composer",
    component: CommunityChatComposer,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
      docs: {
        source: {
          code: `<CommunityChatComposer
  bind:value
  {members}
  {rooms}
  {communityEmojis}
  {draftStore}
  draftKey="community:general"
  {mediaAdapter}
  onSubmit={sendMessage}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Empty"
  args={{
    ...commonArgs,
    placeholder: "Message #general",
    mediaAdapter,
  }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    const composer = editor.closest<HTMLElement>(
      '[data-ui-component="ai-chat-composer"]',
    );
    const composerBody = composer?.querySelector<HTMLElement>(
      ':scope > [data-ui-part="body"]',
    );
    await expect(editor).toBeVisible();
    const placeholder =
      canvasElement.querySelector<HTMLElement>(".cm-placeholder");
    await expect(placeholder).not.toBeNull();
    await expect(
      Number.parseFloat(getComputedStyle(placeholder!).paddingInlineStart),
    ).toBeGreaterThanOrEqual(3.9);
    await expect(composer).toHaveAttribute("data-elevation", "low");
    await expect(composerBody).not.toBeNull();
    await expect(getComputedStyle(composerBody!).boxShadow).not.toBe("none");
    await userEvent.click(editor);
    await expect(getComputedStyle(composerBody!).outlineStyle).toBe("none");
    await expect(
      canvas.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Mention someone" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Selection toolbar and link editor"
  args={{
    ...commonArgs,
    value: "Turn this selection into a useful link.",
  }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.keyboard(
      "{Home}{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}",
    );
    const selectionToolbar = await canvas.findByRole("toolbar", {
      name: "Selection formatting",
    });
    await expect(selectionToolbar).toBeVisible();
    await userEvent.click(
      within(selectionToolbar).getByRole("button", { name: "Link selection" }),
    );
    await expect(
      page.getByRole("heading", { name: "Add a link" }),
    ).toBeVisible();
    await expect(page.getByLabelText("Text")).toHaveValue("Turn");
    await userEvent.click(page.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        page.queryByRole("heading", { name: "Add a link" }),
      ).not.toBeInTheDocument(),
    );
  }}
/>

<Story
  name="Seven-line growth and scrolling"
  args={{
    ...commonArgs,
    value: "one\ntwo\nthree\nfour\nfive\nsix\nseven",
  }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    const scrollArea = canvasElement.querySelector<HTMLElement>(
      ".community-chat-composer__editor-scroll-area",
    );
    const viewport = scrollArea?.querySelector<HTMLElement>(
      ':scope > [data-ui-part="scroll-area-viewport"]',
    );
    await expect(scrollArea).toHaveAttribute(
      "data-ui-component",
      "scroll-area",
    );
    await expect(viewport).not.toBeNull();
    await expect(viewport!.scrollHeight).toBe(viewport!.clientHeight);

    await userEvent.click(editor);
    const cursor = canvasElement.querySelector<HTMLElement>(".cm-cursor");
    await expect(cursor).not.toBeNull();
    await expect(
      Number.parseFloat(getComputedStyle(cursor!).borderInlineStartWidth),
    ).toBeGreaterThanOrEqual(1.9);
    await userEvent.keyboard("{End}{Shift>}{Enter}{/Shift}eight");
    await waitFor(() =>
      expect(viewport!.scrollHeight).toBeGreaterThan(viewport!.clientHeight),
    );
    await expect(
      scrollArea?.querySelector('[data-ui-part="scroll-area-scrollbar"]'),
    ).not.toBeNull();
  }}
/>

<Story
  name="Custom emoji live preview"
  args={{
    ...commonArgs,
    value: "Native emoji stay native 🚀. Custom emoji: ",
  }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    editor.focus();
    await userEvent.keyboard("{End}");
    await fireEvent.click(canvas.getByRole("button", { name: "Add emoji" }));
    await fireEvent.click(await page.findByRole("button", { name: ":lapis:" }));
    await expect(canvas.getByRole("img", { name: ":lapis:" })).toBeVisible();
    await expect(editor).toHaveTextContent("🚀");
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() =>
      expect(
        canvasElement.querySelector('[data-ui-part="composer-custom-emoji"]'),
      ).toBeNull(),
    );
    await userEvent.keyboard("{End}");
    await expect(
      canvasElement.querySelector('[data-ui-part="composer-custom-emoji"]'),
    ).not.toBeNull();
  }}
/>

<Story
  name="Markdown and expanded toolbar"
  args={{
    ...commonArgs,
    formattingOpen: true,
    value:
      "**Release notes** are ready for @Ben Stone in #plugin-development.\n\n> The signed event remains the source of truth.\n\n`pnpm local:smoke` :shipit:",
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Formatting options" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      canvas.getByRole("button", { name: "Hide formatting" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Code block" }),
    ).toBeVisible();
    await expect(canvas.getByText("Release notes")).toBeVisible();
    await expect(canvas.getByRole("img", { name: ":shipit:" })).toBeVisible();
  }}
/>

<Story
  name="Command autocomplete"
  args={{ ...commonArgs }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "Could you review this, @Ben ");
    const people = await canvas.findByRole("listbox", {
      name: "People suggestions",
    });
    await expect(people).toBeVisible();
    await expect(
      Number.parseFloat(getComputedStyle(people).rowGap),
    ).toBeGreaterThan(0);
    await userEvent.keyboard("Sto");
    const ben = await canvas.findByRole("option", { name: /@Ben Stone/ });
    await expect(ben).toBeVisible();
    await userEvent.keyboard("{Backspace}{Backspace}");
    await expect(
      canvas.getByRole("option", { name: /@Ben Stone/ }),
    ).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect(editor).toHaveTextContent("@Ben Stone");
    await userEvent.keyboard("{End} in #plugin-d");
    const channel = await canvas.findByRole("option", {
      name: /#plugin-development/,
    });
    await expect(channel).toBeVisible();
    await userEvent.click(channel);
    await expect(editor).toHaveTextContent("#plugin-development");
    await userEvent.keyboard("{End} :rock");
    const standardEmoji = await canvas.findByRole("option", {
      name: /:rocket:/,
    });
    await expect(standardEmoji).toBeVisible();
    await userEvent.click(standardEmoji);
    await expect(editor).toHaveTextContent("🚀");
  }}
/>

<Story
  name="Autocomplete flips below near the top edge"
  args={{ ...commonArgs }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "@Ben");
    const suggestions = await canvas.findByRole("listbox", {
      name: "People suggestions",
    });
    const layer = suggestions.closest<HTMLElement>(
      '[data-ui-part="composer-autocomplete-layer"]',
    );
    const composer = canvasElement.querySelector<HTMLElement>(
      '[data-ui-component="community-chat-composer"]',
    );
    await expect(layer).toHaveAttribute("data-placement", "below");
    await expect(layer!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      composer!.getBoundingClientRect().bottom,
    );
  }}
>
  {#snippet template(args)}
    <div
      style="position: fixed; top: 0.5rem; right: 2rem; left: 2rem; margin: 0 auto;"
    >
      <CommunityChatComposer {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Reply with attachment"
  args={{
    ...commonArgs,
    context: {
      kind: "reply",
      target: {
        eventId: "message-release",
        roomId: "general",
        authorId: "ben",
        authorName: "Ben Stone",
        content: "The registry now links back to the support forum.",
        kind: "channel",
      },
    },
    mediaAdapter,
    onCancelContext: fn(),
  }}
  play={async ({ canvas, canvasElement }) => {
    const fileInput =
      canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    await expect(fileInput).not.toBeNull();
    await fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(
            [
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 48"><rect width="80" height="48" rx="6" fill="#e0e7ff"/><path d="m13 36 15-17 10 11 9-8 20 20H8z" fill="#4f46e5"/></svg>`,
            ],
            "registry-preview.svg",
            { type: "image/svg+xml" },
          ),
          new File(["relay upload log"], "relay-log.txt", {
            type: "text/plain",
          }),
        ],
      },
    });
    const imagePreview = canvas.getByRole("listitem", {
      name: /registry-preview\.svg/,
    });
    const filePreview = canvas.getByRole("listitem", {
      name: /relay-log\.txt/,
    });
    await waitFor(() =>
      expect(imagePreview).toHaveAttribute("data-status", "uploaded"),
    );
    await waitFor(() =>
      expect(filePreview).toHaveAttribute("data-status", "uploaded"),
    );
    await expect(imagePreview.querySelector("img")).not.toBeNull();
    await expect(
      Math.abs(
        imagePreview.getBoundingClientRect().width -
          imagePreview.getBoundingClientRect().height,
      ),
    ).toBeLessThan(1);
    await expect(
      canvas.getByRole("button", { name: "Cancel reply" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Reply context and actionable error"
  args={{
    ...commonArgs,
    value: "The message stays editable while the relay reconnects.",
    context: {
      kind: "reply",
      target: {
        eventId: "message-release",
        roomId: "general",
        authorId: "ben",
        authorName: "Ben Stone",
        content: "Can we verify the Markdown rendering before migration?",
        kind: "channel",
      },
    },
    composerStatus: {
      type: "error",
      message: "The relay rejected the previous attempt.",
    },
    onCancelContext: fn(),
    onRetryComposerStatus: fn(),
    onDismissComposerStatus: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const reply = canvas.getByLabelText("Replying to Ben Stone");
    const composer = reply.closest<HTMLElement>(
      '[data-ui-component="ai-chat-composer"]',
    );
    const composerBody = composer?.querySelector<HTMLElement>(
      ':scope > [data-ui-part="body"]',
    );
    const error = canvas.getByRole("alert");
    await expect(reply).toBeVisible();
    await expect(
      reply.closest('[data-ui-component="ai-chat-composer-drawer"]'),
    ).not.toBeNull();
    await expect(composerBody).not.toBeNull();
    await expect(getComputedStyle(reply).borderTopLeftRadius).toBe(
      getComputedStyle(composerBody!).borderTopLeftRadius,
    );
    await expect(error).toHaveAttribute("data-status", "error");
    await expect(error).toHaveTextContent(
      "The relay rejected the previous attempt.",
    );
    await expect(
      canvasElement.querySelector('[data-ui-part="composer-status-actions"]'),
    ).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(args.onRetryComposerStatus).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(args.onDismissComposerStatus).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Failed attachment and disabled composer"
  args={{
    ...commonArgs,
    value: "This draft stays available while the relay is offline.",
    mediaAdapter,
    disabled: true,
    disabledReason: "Reconnect to the community relay to send this message.",
    initialAttachments: [
      {
        id: "failed-upload",
        name: "release-log.txt",
        mimeType: "text/plain",
        size: 16384,
        status: "failed",
        error: "Upload interrupted — try again",
      },
    ],
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText(
        "Reconnect to the community relay to send this message.",
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole("listitem", {
        name: /release-log\.txt\. Upload interrupted — try again/,
      }),
    ).toHaveAttribute("data-status", "failed");
    await expect(
      canvas.getByRole("button", { name: "Send message" }),
    ).toBeDisabled();
  }}
/>

<Story
  name="Restored draft"
  args={{
    ...commonArgs,
    draftStore,
    draftKey: "story:lapis:plugin-development",
  }}
  play={async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await waitFor(() =>
      expect(editor).toHaveTextContent(
        "Draft restored locally for @Mara Chen in #plugin-development.",
      ),
    );
  }}
/>

<Story name="Composer to message preview">
  {#snippet template()}
    <CommunityChatComposerStoryHarness />
  {/snippet}
</Story>

<style>
  :global(.community-chat-composer-story) {
    width: min(48rem, calc(100vw - 4rem));
    min-width: min(48rem, calc(100vw - 4rem));
  }
</style>
