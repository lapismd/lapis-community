<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import {
    communityComposerStoryEmojis,
    communityComposerStoryRooms,
  } from "../community-chat-composer/story-fixtures.js";
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
    message: {
      ...communityStoryMessages[1]!,
      content:
        "The **release is ready** in #plugin-development :lapis:. ||Keep the relay key private.||",
    },
    author: communityStoryMembers[1]!,
    members: communityStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    replyParticipants: communityStoryMembers.slice(0, 3),
    density: "compact",
    onReply: fn(),
    onOpenThread: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
    onCopyLink: fn(),
    onDelete: fn(),
    onOpenProfile: fn(),
    onOpenRoom: fn(),
    onMessageMember: fn(),
    onViewMemberActivity: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const message = canvas.getByLabelText("Message from Ben Stone");
    const messageCanvas = within(message);
    const addReaction = messageCanvas.getByRole("button", {
      name: "Add reaction",
    });
    const avatar = messageCanvas.getByRole("button", {
      name: "View Ben Stone's profile",
    });

    await expect(messageCanvas.getByText("release is ready").tagName).toBe(
      "STRONG",
    );
    await expect(
      messageCanvas.getByRole("img", { name: ":lapis:" }),
    ).toBeVisible();
    await expect(
      messageCanvas.getByRole("button", { name: "Reveal spoiler" }),
    ).toBeVisible();
    await expect(getComputedStyle(avatar).cursor).toBe("pointer");
    await expect(
      messageCanvas.queryByRole("button", { name: "React with 👍" }),
    ).not.toBeInTheDocument();
    await expect(addReaction).not.toBeVisible();

    await userEvent.hover(message);
    await userEvent.unhover(message);
    await new Promise((resolve) => setTimeout(resolve, 220));
    await expect(addReaction).not.toBeVisible();

    await userEvent.hover(message);
    await waitFor(() => expect(addReaction).toBeVisible());
    const actions = messageCanvas.getByRole("group", {
      name: "Actions for Ben Stone's message",
    });
    const reply = messageCanvas.getByRole("button", {
      name: "Reply in thread",
    });
    await expect(actions.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(
      message.getBoundingClientRect().top,
    );
    await userEvent.unhover(message);
    await userEvent.hover(reply);
    await new Promise((resolve) => setTimeout(resolve, 180));
    await expect(addReaction).toBeVisible();
    await userEvent.click(reply);
    await expect(args.onReply).toHaveBeenCalledWith("message-release");
    await expect(args.onOpenThread).not.toHaveBeenCalled();

    await userEvent.click(
      messageCanvas.getByRole("button", {
        name: "8 replies · last reply 4 minutes ago",
      }),
    );
    await expect(args.onOpenThread).toHaveBeenCalledWith("message-release");

    await userEvent.click(
      messageCanvas.getByRole("button", {
        name: "4 reactions with 🎉",
      }),
    );
    await expect(args.onToggleReaction).toHaveBeenCalledWith(
      "message-release",
      "🎉",
    );
    await userEvent.click(
      messageCanvas.getByRole("button", { name: "#plugin-development" }),
    );
    await expect(args.onOpenRoom).toHaveBeenCalledWith("plugin-development");

    await userEvent.hover(avatar);
    await expect(
      await page.findByLabelText("Ben Stone contact preview"),
    ).toBeVisible();
    await userEvent.click(avatar);
    await expect(args.onOpenProfile).toHaveBeenCalledWith(
      communityStoryMembers[1],
    );
    await userEvent.unhover(avatar);
    await waitFor(() =>
      expect(
        page.queryByLabelText("Ben Stone contact preview"),
      ).not.toBeInTheDocument(),
    );
  }}
/>
