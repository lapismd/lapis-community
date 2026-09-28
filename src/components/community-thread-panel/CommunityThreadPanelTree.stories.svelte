<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import {
    communityStoryMembers,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const branchThread = {
    ...communityStoryThread,
    messages: [
      communityStoryThread.messages[0]!,
      communityStoryThread.messages[1]!,
      {
        id: "thread-later-direct",
        authorId: "noor",
        parentMessageId: communityStoryThread.rootMessageId,
        timestamp: "09:21",
        content: "A later direct reply stays after the expanded parent branch.",
      },
      communityStoryThread.messages[2]!,
      {
        ...communityStoryThread.messages[3]!,
        parentMessageId: "thread-1",
      },
    ],
  };

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Panel/Tree",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Replies follow their parent branch"
  args={{ thread: branchThread, members: communityStoryMembers }}
  play={async ({ canvas }) => {
    const list = canvas.getByRole("log", { name: "Thread replies" });
    const treeRows = Array.from(
      list.querySelectorAll<HTMLElement>('[data-ui-part="thread-tree-row"]'),
    );
    await expect(treeRows).toHaveLength(5);
    await expect(treeRows.map((row) => row.dataset.threadDepth)).toEqual([
      "0",
      "1",
      "2",
      "2",
      "1",
    ]);

    const messageLeft = (row: HTMLElement): number =>
      row
        .querySelector<HTMLElement>('[data-ui-component="ai-chat-message"]')!
        .getBoundingClientRect().left;
    const [rootRow, directReply, nestedReply, nestedFollowup] = treeRows;
    await expect(
      Math.abs(messageLeft(directReply!) - messageLeft(rootRow!)),
    ).toBeLessThanOrEqual(1);
    await expect(
      messageLeft(nestedReply!) - messageLeft(directReply!),
    ).toBeGreaterThanOrEqual(32);
    await expect(
      Math.abs(messageLeft(nestedFollowup!) - messageLeft(nestedReply!)),
    ).toBeLessThanOrEqual(1);
    await expect(
      nestedReply!.querySelector('[data-ui-part="thread-reply-connector"]'),
    ).not.toBeNull();
    await expect(
      directReply!.querySelector('[data-ui-part="thread-descendant-guide"]'),
    ).not.toBeNull();
    await expect(treeRows.at(-1)).toHaveTextContent(
      "A later direct reply stays after the expanded parent branch.",
    );
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 28rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityThreadPanel {...args} />
    </div>
  {/snippet}
</Story>
