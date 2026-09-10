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

  const releaseContent =
    "The **release is ready** in #plugin-development :lapis:. ||Keep the relay key private.||";
  const releaseEvent = {
    id: "message-release",
    pubkey: "ben",
    created_at: 1_788_340_680,
    kind: 9,
    tags: [["h", "plugin-releases"]],
    content: releaseContent,
    sig: "story-signature",
  };
</script>

<Story
  name="Message with thread and reactions"
  args={{
    message: {
      ...communityStoryMessages[1]!,
      content: releaseContent,
      sourceEvent: releaseEvent,
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
    onCopyMessage: fn(),
    onCopyEvent: fn(),
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
    await expect(getComputedStyle(reply).borderRadius).toBe(
      getComputedStyle(actions).borderRadius,
    );
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

    avatar.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpenProfile).toHaveBeenCalledWith(
      communityStoryMembers[1],
    );

    await userEvent.hover(message);
    await userEvent.click(
      messageCanvas.getByRole("button", { name: "More message actions" }),
    );
    const copyEvent = await page.findByRole("menuitem", {
      name: "Copy event",
    });
    const menu = copyEvent.closest<HTMLElement>('[role="menu"]');
    await expect(menu).not.toBeNull();
    await expect(menu!.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      216,
    );
    await userEvent.click(copyEvent);
    await expect(args.onCopyEvent).toHaveBeenCalledWith("message-release");
  }}
/>

<Story
  name="Author edit delete and report actions"
  args={{
    message: communityStoryMessages[3]!,
    author: communityStoryMembers[3]!,
    members: communityStoryMembers,
    rooms: communityComposerStoryRooms,
    density: "compact",
    isContinuation: true,
    onEdit: fn(),
    onDelete: fn(),
    onReport: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const message = canvas.getByLabelText("Message from Mara Chen");
    const view = within(message);
    await expect(view.getByText("(edited)")).toBeVisible();

    await userEvent.hover(view.getByText(/UI category is derived/));
    await waitFor(() =>
      expect(
        view.getByRole("button", { name: "More message actions" }),
      ).toBeVisible(),
    );
    await userEvent.click(
      view.getByRole("button", { name: "More message actions" }),
    );
    await userEvent.click(
      await page.findByRole("menuitem", { name: "Edit message" }),
    );
    await expect(args.onEdit).toHaveBeenCalledWith("message-answer");

    await userEvent.click(
      view.getByRole("button", { name: "More message actions" }),
    );
    await userEvent.click(
      await page.findByRole("menuitem", { name: "Report message" }),
    );
    const report = await page.findByRole("dialog", { name: "Report message" });
    await userEvent.click(within(report).getByRole("radio", { name: "Spam" }));
    await userEvent.click(
      within(report).getByRole("button", { name: "Submit report" }),
    );
    await expect(args.onReport).toHaveBeenCalledWith("message-answer", {
      category: "spam",
    });

    await userEvent.click(
      view.getByRole("button", { name: "More message actions" }),
    );
    await userEvent.click(
      await page.findByRole("menuitem", { name: "Delete message" }),
    );
    const confirmation = await page.findByRole("alertdialog", {
      name: "Delete message?",
    });
    await userEvent.click(
      within(confirmation).getByRole("button", { name: "Delete message" }),
    );
    await expect(args.onDelete).toHaveBeenCalledWith("message-answer");
  }}
/>

<Story
  name="Continuation message"
  args={{
    message: {
      ...communityStoryMessages[1]!,
      id: "message-continuation",
      timestamp: "21:01",
      content: "Bases 0.1.2 is ready for curator review.",
      reactions: [],
      replyCount: 0,
      replyParticipantIds: [],
    },
    author: communityStoryMembers[1]!,
    members: communityStoryMembers,
    rooms: communityComposerStoryRooms,
    communityEmojis: communityComposerStoryEmojis,
    density: "compact",
    isContinuation: true,
  }}
  play={async ({ canvas }) => {
    const message = canvas.getByLabelText("Message from Ben Stone");
    const timestamp = message.querySelector<HTMLElement>(
      '[data-ui-part="continuation-time"]',
    );
    const firstLine = message.querySelector<HTMLElement>(
      '[data-ui-component="community-markdown-content"] p',
    );

    await expect(timestamp).not.toBeNull();
    await expect(firstLine).not.toBeNull();
    await expect(Number.parseFloat(getComputedStyle(message).paddingTop)).toBe(
      4,
    );
    await expect(getComputedStyle(timestamp!).opacity).toBe("0");

    await userEvent.hover(message);
    await waitFor(() => expect(getComputedStyle(timestamp!).opacity).toBe("1"));
    await expect(
      Math.abs(
        timestamp!.getBoundingClientRect().top -
          firstLine!.getBoundingClientRect().top,
      ),
    ).toBeLessThanOrEqual(1);

    await userEvent.unhover(message);
  }}
/>
