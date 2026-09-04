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
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
    ).toBeVisible();
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
  }}
/>

<Story
  name="Mention and channel autocomplete"
  args={{ ...commonArgs }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "Could you review this, @Mar");
    const mara = await page.findByText("@Mara Chen");
    await expect(mara).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect(editor).toHaveTextContent("@Mara Chen");
    await userEvent.keyboard("{End} in #plugin-d");
    const channel = await page.findByText("#plugin-development");
    await expect(channel).toBeVisible();
    await userEvent.click(channel);
    await expect(editor).toHaveTextContent("#plugin-development");
  }}
/>

<Story
  name="Reply with attachment"
  args={{
    ...commonArgs,
    context: {
      kind: "reply",
      id: "message-release",
      label: "Ben Stone",
      excerpt: "The registry now links back to the support forum.",
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
        ],
      },
    });
    await expect(canvas.getByText("registry-preview.svg")).toBeVisible();
    await waitFor(() => expect(canvas.getByText(/Ready/)).toBeVisible());
    await expect(
      canvas.getByRole("button", { name: "Cancel reply" }),
    ).toBeVisible();
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
      canvas.getByText("Upload interrupted — try again"),
    ).toBeVisible();
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
