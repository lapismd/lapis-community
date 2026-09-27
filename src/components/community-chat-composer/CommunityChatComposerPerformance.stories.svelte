<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import CommunityChatComposer from "./CommunityChatComposer.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Chat Composer Performance",
    component: CommunityChatComposer,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Shared editor contains typing work"
  args={{
    ariaLabel: "Shared composer performance",
    onSubmit: fn(),
  }}
  play={async ({ canvas, canvasElement }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    const editorWrap = canvasElement.querySelector<HTMLElement>(
      ".community-chat-composer__editor-wrap",
    );
    await expect(editorWrap).not.toBeNull();
    await expect(getComputedStyle(editorWrap!).contain).toContain("layout");
    await expect(getComputedStyle(editorWrap!).contain).toContain("style");
    await userEvent.type(editor, "Typing remains inside the shared editor");
    await expect(editor).toHaveTextContent(
      "Typing remains inside the shared editor",
    );
  }}
/>
