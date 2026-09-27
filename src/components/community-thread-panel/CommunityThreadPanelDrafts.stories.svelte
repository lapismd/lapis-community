<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryNavigation,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";
  import CommunityThreadPanelDraftHost from "./CommunityThreadPanelDraftHost.svelte";

  const rooms = communityStoryNavigation.flatMap((section) => section.rooms);
  const performanceThread = {
    ...communityStoryThread,
    rootMessageId: "story-thread-composer-performance",
    messages: communityStoryThread.messages.map((message, index) =>
      index === 0
        ? { ...message, id: "story-thread-composer-performance" }
        : message,
    ),
  };

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Panel Drafts",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
    parameters: {
      layout: "padded",
      docs: {
        source: {
          code: `<CommunityThreadPanel
  {thread}
  {members}
  {rooms}
  currentMemberId="story-member"
  onSendReply={sendReply}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Remount restores a thread reply draft"
  play={async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "Keep this thread draft");
    await waitFor(() => {
      expect(editor).toHaveTextContent("Keep this thread draft");
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Remount" }));
    const restored = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(restored).toHaveTextContent("Keep this thread draft");
    });
  }}
>
  {#snippet template()}
    <CommunityThreadPanelDraftHost />
  {/snippet}
</Story>

<Story
  name="Persisted thread typing stays local"
  args={{
    thread: performanceThread,
    members: communityStoryMembers,
    rooms,
    currentMemberId: "story-member",
    presentation: { key: "story:thread:composer-performance", draft: "" },
    onPresentationChange: fn(),
    onSendReply: fn(),
  }}
  play={async ({ canvas, args }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    const before = args.onPresentationChange.mock.calls.length;
    await userEvent.click(editor);
    await userEvent.type(editor, "Thread typing stays responsive");
    await expect(editor).toHaveTextContent("Thread typing stays responsive");
    await waitFor(() =>
      expect(args.onPresentationChange.mock.calls.length).toBe(before),
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
