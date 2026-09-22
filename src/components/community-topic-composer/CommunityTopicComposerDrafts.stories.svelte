<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import CommunityTopicComposer from "./CommunityTopicComposer.svelte";
  import CommunityTopicComposerDraftHost from "./CommunityTopicComposerDraftHost.svelte";

  const { Story } = defineMeta({
    title: "Community/Forums/Topic composer drafts",
    component: CommunityTopicComposer,
    tags: ["visual-pending"],
    parameters: {
      layout: "padded",
      docs: {
        source: {
          code: `<CommunityTopicComposer
  forumName="support"
  currentMemberId="story-member"
  onPublish={publishTopic}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Remount restores a new-topic draft"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Start a new post in support" }),
    );
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "Keep this topic draft");
    await waitFor(() => {
      expect(editor).toHaveTextContent("Keep this topic draft");
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Remount" }));
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Start a new post in support",
      }),
    );
    const restored = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(restored).toHaveTextContent("Keep this topic draft");
    });
  }}
>
  {#snippet template()}
    <CommunityTopicComposerDraftHost roomId="support-restore" />
  {/snippet}
</Story>

<Story
  name="Cancel removes the stored new-topic draft"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Start a new post in support" }),
    );
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "Discard this topic draft");
    await waitFor(() => {
      expect(editor).toHaveTextContent("Discard this topic draft");
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await userEvent.click(canvas.getByRole("button", { name: "Remount" }));
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Start a new post in support",
      }),
    );
    const empty = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(empty).not.toHaveTextContent("Discard this topic draft");
    });
  }}
>
  {#snippet template()}
    <CommunityTopicComposerDraftHost roomId="support-cancel" />
  {/snippet}
</Story>
