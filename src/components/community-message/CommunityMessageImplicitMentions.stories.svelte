<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, within } from "storybook/test";

  import { communityComposerStoryFizz } from "../community-chat-composer/agent-story-fixtures.js";
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

  const author = communityStoryMembers[1]!;
  const fizz = {
    id: communityComposerStoryFizz,
    name: "Fizz",
    handle: "fizz",
    initials: "FZ",
    kind: "agent" as const,
  };
  const members = [...communityStoryMembers, fizz];
  const replyParticipants = communityStoryMembers.slice(0, 3);
</script>

<Story
  name="Implicit mention avatars"
  args={{
    message: {
      ...communityStoryMessages[1]!,
      id: "message-implicit-mention",
      content: "please continue from the last checkpoint.",
      mentionPubkeys: [fizz.id],
    },
    author,
    members,
    replyParticipants,
    density: "compact",
    avatarShape: "rounded",
    onOpenThread: fn(),
    onOpenProfile: fn(),
  }}
  play={async ({ canvas }) => {
    const message = canvas.getByLabelText("Message from Ben Stone");
    const metadata = message.querySelector(".community-message__metadata");
    const replies = canvas.getByRole("group", { name: "Reply participants" });
    await expect(metadata).not.toBeNull();
    await expect(
      canvas.queryByRole("group", { name: "Tagged Fizz" }),
    ).toBeNull();
    await expect(
      within(replies).getByRole("button", { name: "View Fizz's profile" }),
    ).toBeVisible();
    await expect(message.textContent).not.toMatch(/@Fizz/u);
    const timestamp = metadata!.querySelector(
      '[data-ui-component="ai-chat-message-metadata"]',
    );
    await expect(timestamp).not.toBeNull();
    await expect(
      timestamp!.compareDocumentPosition(replies) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }}
/>

<Story
  name="Thread reply implicit mention"
  args={{
    message: {
      id: "message-thread-continue",
      authorId: "ben",
      parentMessageId: "message-release",
      timestamp: "07:27",
      content: "continue",
      mentionPubkeys: [fizz.id],
    },
    author,
    members,
    density: "compact",
    avatarShape: "rounded",
    onOpenProfile: fn(),
  }}
  play={async ({ canvas }) => {
    const message = canvas.getByLabelText("Message from Ben Stone");
    const metadata = message.querySelector(".community-message__metadata");
    const tagged = canvas.getByRole("group", { name: "Tagged Fizz" });
    await expect(metadata).not.toBeNull();
    await expect(
      canvas.queryByRole("group", { name: "Reply participants" }),
    ).toBeNull();
    await expect(
      within(tagged).getByRole("button", { name: "View Fizz's profile" }),
    ).toBeVisible();
    const timestamp = metadata!.querySelector(
      '[data-ui-component="ai-chat-message-metadata"]',
    );
    await expect(timestamp).not.toBeNull();
    await expect(
      timestamp!.compareDocumentPosition(tagged) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }}
/>

<Story
  name="In-body mention hides metadata avatars"
  args={{
    message: {
      ...communityStoryMessages[1]!,
      id: "message-body-mention",
      content: "@Fizz please continue from the last checkpoint.",
      mentionPubkeys: [fizz.id],
    },
    author,
    members,
    replyParticipants,
    density: "compact",
    avatarShape: "rounded",
    onOpenThread: fn(),
  }}
  play={async ({ canvas }) => {
    const replies = canvas.getByRole("group", { name: "Reply participants" });
    await expect(
      within(replies).queryByRole("button", { name: "View Fizz's profile" }),
    ).toBeNull();
    await expect(canvas.getByRole("button", { name: "Fizz" })).toBeVisible();
  }}
/>

<Story
  name="Reply participant mention is not duplicated"
  args={{
    message: {
      ...communityStoryMessages[1]!,
      id: "message-duplicate-mention",
      content: "please continue from the last checkpoint.",
      mentionPubkeys: [fizz.id],
    },
    author,
    members,
    replyParticipants: [fizz, ...replyParticipants],
    density: "compact",
    avatarShape: "rounded",
    onOpenThread: fn(),
    onOpenProfile: fn(),
  }}
  play={async ({ canvas }) => {
    const replies = canvas.getByRole("group", { name: "Reply participants" });
    await expect(
      within(replies).getAllByRole("button", { name: "View Fizz's profile" }),
    ).toHaveLength(1);
    await expect(
      canvas.queryByRole("group", { name: "Tagged Fizz" }),
    ).toBeNull();
  }}
/>
