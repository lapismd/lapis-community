<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import CommunityComposerSlashStoryHost from "./CommunityComposerSlashStoryHost.svelte";
  import {
    communityComposerStoryEmojis,
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "./story-fixtures.js";

  const onSubmit = fn();

  const { Story } = defineMeta({
    title: "Community/Channels/Chat Composer Entity Links",
    component: CommunityComposerSlashStoryHost,
    tags: ["visual-pending"],
    parameters: { layout: "padded" },
  });
</script>

<Story
  name="Slash kind inserts a scheme chip"
  args={{
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    currentMemberId: "ada",
    onSubmit,
  }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "/tasks/awesome");
    const option = await canvas.findByRole("option", { name: /Awesome/i });
    await userEvent.click(option);
    await waitFor(() =>
      expect(
        canvasElement.querySelector("[data-link-kind='task']"),
      ).not.toBeNull(),
    );
    await expect(editor).not.toHaveTextContent("/tasks/awesome");
  }}
/>
