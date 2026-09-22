<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  import {
    communityComposerStoryEmojis,
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "./story-fixtures.js";

  const onSubmit = fn();

  const { Story } = defineMeta({
    title: "Community/Channels/Chat Composer Entity Links",
    component: CommunityChatComposer,
    tags: ["visual-pending"],
    parameters: { layout: "padded" },
  });
</script>

<Story
  name="Paste hash becomes a scheme chip"
  args={{
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    currentMemberId: "ada",
    onSubmit,
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    const content = canvasElement.querySelector(".cm-content");
    await expect(content).not.toBeNull();
    const data = new DataTransfer();
    data.setData("text/plain", "#/channels/plugin-development");
    content!.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitFor(() =>
      expect(
        canvasElement.querySelector("[data-link-kind='channel']"),
      ).not.toBeNull(),
    );
    await userEvent.click(canvas.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
    await expect(args.onSubmit.mock.calls[0]?.[0]?.content).toBe(
      "lapis-community://channel/plugin-development",
    );
  }}
/>
