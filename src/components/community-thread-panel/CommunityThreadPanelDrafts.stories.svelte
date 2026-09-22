<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";
  import CommunityThreadPanelDraftHost from "./CommunityThreadPanelDraftHost.svelte";

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
