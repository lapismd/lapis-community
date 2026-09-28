<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import { communityStoryMembers } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const messages = [
    {
      id: "thread-root",
      authorId: "ben",
      timestamp: "09:00",
      createdAt: "2026-09-02T09:00:00Z",
      content: "Root message for the grouping boundary.",
    },
    {
      id: "thread-read-reply",
      authorId: "ben",
      parentMessageId: "thread-root",
      timestamp: "09:01",
      createdAt: "2026-09-02T09:01:00Z",
      content: "This reply is still in the read section.",
    },
    {
      id: "thread-unread-start",
      authorId: "ben",
      parentMessageId: "thread-read-reply",
      timestamp: "09:02",
      createdAt: "2026-09-02T09:02:00Z",
      content: "This first unread reply must show my identity.",
    },
    {
      id: "thread-unread-follow-up",
      authorId: "ben",
      parentMessageId: "thread-unread-start",
      timestamp: "09:03",
      createdAt: "2026-09-02T09:03:00Z",
      content: "This reply can continue the unread group.",
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Grouping",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Thread identity boundaries"
  args={{
    thread: { rootMessageId: "thread-root", messages },
    members: communityStoryMembers,
    history: {
      hasOlder: false,
      loading: false,
      unreadEventIds: ["thread-unread-start", "thread-unread-follow-up"],
    },
  }}
  play={async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('[data-message-id="thread-unread-start"]'),
    ).not.toHaveAttribute("data-continuation");
    await expect(
      canvasElement.querySelector(
        '[data-message-id="thread-unread-follow-up"]',
      ),
    ).toHaveAttribute("data-continuation");
  }}
>
  {#snippet template(args)}
    <div style="width: min(100%, 28rem); height: 28rem">
      <CommunityThreadPanel {...args} />
    </div>
  {/snippet}
</Story>
