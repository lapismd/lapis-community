<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryMessages,
  } from "../community-workspace/story-fixtures.js";
  import CommunityMessage from "./CommunityMessage.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Message",
    component: CommunityMessage,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Message with thread and reactions"
  args={{
    message: communityStoryMessages[1]!,
    author: communityStoryMembers[1]!,
    replyParticipants: communityStoryMembers.slice(0, 3),
    density: "compact",
    onOpenThread: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
    onCopyLink: fn(),
    onDelete: fn(),
    onOpenProfile: fn(),
  }}
  play={async ({ canvas, args }) => {
    const message = canvas.getByLabelText("Message from Ben Stone");
    const messageCanvas = within(message);
    const addReaction = messageCanvas.getByRole("button", {
      name: "Add reaction",
    });
    const avatar = messageCanvas.getByRole("button", {
      name: "View Ben Stone's profile",
    });

    await expect(getComputedStyle(avatar).cursor).toBe("pointer");
    await expect(addReaction).not.toBeVisible();
    addReaction.focus();
    await waitFor(() => expect(addReaction).toBeVisible());
    await userEvent.click(
      messageCanvas.getByRole("button", {
        name: "4 reactions with 🎉",
      }),
    );
    await expect(args.onToggleReaction).toHaveBeenCalledWith(
      "message-release",
      "🎉",
    );
    await userEvent.click(avatar);
    await expect(args.onOpenProfile).toHaveBeenCalledWith(
      communityStoryMembers[1],
    );
  }}
/>
