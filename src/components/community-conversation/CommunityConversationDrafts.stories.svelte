<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryMessages,
    communityStoryNavigation,
  } from "../community-workspace/story-fixtures.js";
  import CommunityConversation from "./CommunityConversation.svelte";

  const generalRoom = communityStoryNavigation[0]!.rooms[1]!;

  const { Story } = defineMeta({
    title: "Community/Channels/Conversation Drafts",
    component: CommunityConversation,
    tags: ["visual-pending"],
    parameters: {
      layout: "padded",
      docs: {
        source: {
          code: `<CommunityConversation
  {room}
  {messages}
  {members}
  draftKey="story:lc-ui-052:channel"
  onSend={sendMessage}
/>`,
        },
      },
    },
  });
</script>

<script lang="ts">
  let remount = $state(0);
</script>

<Story
  name="Remount restores a channel draft"
  play={async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "Keep this channel draft");
    await waitFor(() => {
      expect(editor).toHaveTextContent("Keep this channel draft");
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Remount" }));
    const restored = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(restored).toHaveTextContent("Keep this channel draft");
    });
  }}
>
  {#snippet template()}
    <div>
      <button type="button" onclick={() => (remount += 1)}>Remount</button>
      {#key remount}
        <CommunityConversation
          room={generalRoom}
          messages={communityStoryMessages}
          members={communityStoryMembers}
          draftKey="story:lc-ui-052:channel"
          onSend={fn()}
        />
      {/key}
    </div>
  {/snippet}
</Story>
