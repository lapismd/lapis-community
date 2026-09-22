<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import CommunityPersistedComposer from "./CommunityPersistedComposer.svelte";
  import CommunityPersistedComposerStoryHost from "./CommunityPersistedComposerStoryHost.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Persisted Composer",
    component: CommunityPersistedComposer,
    tags: ["visual-pending"],
    parameters: {
      layout: "padded",
      docs: {
        source: {
          code: `<CommunityPersistedComposer
  {draftKey}
  {draftStore}
  bind:value
  {members}
  {rooms}
  onSubmit={sendMessage}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Remount restores and isolates rooms"
  play={async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "Keep this draft");
    await waitFor(
      () => {
        expect(editor).toHaveTextContent("Keep this draft");
      },
      { timeout: 1_000 },
    );
    await new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Remount" }));
    const restored = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(restored).toHaveTextContent("Keep this draft");
    });
    await userEvent.click(canvas.getByRole("button", { name: "Switch room" }));
    const otherRoom = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(otherRoom).not.toHaveTextContent("Keep this draft");
    });
    await userEvent.click(canvas.getByRole("button", { name: "Switch room" }));
    const returned = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(returned).toHaveTextContent("Keep this draft");
    });
  }}
>
  {#snippet template()}
    <CommunityPersistedComposerStoryHost />
  {/snippet}
</Story>
