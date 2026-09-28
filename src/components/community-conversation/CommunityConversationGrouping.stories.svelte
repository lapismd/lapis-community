<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryNavigation,
  } from "../community-workspace/story-fixtures.js";
  import CommunityConversation from "./CommunityConversation.svelte";

  const author = communityStoryMembers.find((member) => member.id === "noor")!;
  const messages = [
    {
      id: "message-day-end",
      authorId: author.id,
      timestamp: "23:59",
      createdAt: "2026-09-02T22:59:00Z",
      content: "I will finish this note before the day changes.",
    },
    {
      id: "message-day-start",
      authorId: author.id,
      timestamp: "00:01",
      createdAt: "2026-09-02T23:01:00Z",
      content: "This starts a new day and must show my identity.",
    },
    {
      id: "message-unread-start",
      authorId: author.id,
      timestamp: "00:02",
      createdAt: "2026-09-02T23:02:00Z",
      content: "This starts the unread section and must show my identity.",
    },
    {
      id: "message-unread-follow-up",
      authorId: author.id,
      timestamp: "00:03",
      createdAt: "2026-09-02T23:03:00Z",
      content: "This follow-up can continue the unread group.",
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Channels/Message Grouping",
    component: CommunityConversation,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Channel identity boundaries"
  args={{
    room: communityStoryNavigation[0]!.rooms[1]!,
    messages,
    members: communityStoryMembers,
    history: {
      hasOlder: false,
      loading: false,
      unreadEventIds: ["message-unread-start", "message-unread-follow-up"],
    },
  }}
  play={async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('[data-message-id="message-day-start"]'),
    ).not.toHaveAttribute("data-continuation");
    await expect(
      canvasElement.querySelector('[data-message-id="message-unread-start"]'),
    ).not.toHaveAttribute("data-continuation");
    await expect(
      canvasElement.querySelector(
        '[data-message-id="message-unread-follow-up"]',
      ),
    ).toHaveAttribute("data-continuation");
  }}
>
  {#snippet template(args)}
    <div style="width: min(100%, 54rem); height: 28rem">
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>
