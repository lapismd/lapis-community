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
  const presentationKey = "story:conversation:composer-performance";

  const { Story } = defineMeta({
    title: "Community/Channels/Conversation Composer Performance",
    component: CommunityConversation,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Persisted draft typing stays local"
  args={{
    room: generalRoom,
    draftKey: presentationKey,
    presentation: { key: presentationKey, draft: "" },
    onPresentationChange: fn(),
    messages: communityStoryMessages,
    members: communityStoryMembers,
    currentMemberId: "ada",
    onSend: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    const editorWrap = canvasElement.querySelector<HTMLElement>(
      ".community-chat-composer__editor-wrap",
    );
    await expect(editorWrap).not.toBeNull();
    await expect(getComputedStyle(editorWrap!).contain).toContain("layout");
    await expect(getComputedStyle(editorWrap!).contain).toContain("style");

    const before = args.onPresentationChange.mock.calls.length;
    await userEvent.click(editor);
    await userEvent.type(editor, "The quick brown fox");
    await expect(editor).toHaveTextContent("The quick brown fox");
    await waitFor(() =>
      expect(args.onPresentationChange.mock.calls.length).toBe(before),
    );
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>
