<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import CommunityProjectsReviewDraftHost from "./CommunityProjectsReviewDraftHost.svelte";
  import CommunityProjectsTaskCommentComposer from "./CommunityProjectsTaskCommentComposer.svelte";

  const { Story } = defineMeta({
    title: "Community/Projects/Review drafts",
    component: CommunityProjectsTaskCommentComposer,
    tags: ["visual-pending"],
    parameters: {
      layout: "padded",
    },
  });

  async function typeAndRemount(
    canvas: {
      getByRole: (role: string, options?: { name?: string }) => HTMLElement;
      findByRole: (
        role: string,
        options?: { name?: string },
      ) => Promise<HTMLElement>;
    },
    text: string,
  ): Promise<void> {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, text);
    await waitFor(() => {
      expect(editor).toHaveTextContent(text);
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Remount" }));
    const restored = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(restored).toHaveTextContent(text);
    });
  }
</script>

<Story
  name="Remount restores a task comment draft"
  play={async ({ canvas }) => {
    await typeAndRemount(canvas, "Keep this task draft");
  }}
>
  {#snippet template()}
    <CommunityProjectsReviewDraftHost surface="task" />
  {/snippet}
</Story>

<Story
  name="Remount restores a pull-request conversation draft"
  play={async ({ canvas }) => {
    await typeAndRemount(canvas, "Keep this review draft");
  }}
>
  {#snippet template()}
    <CommunityProjectsReviewDraftHost surface="pull-request" />
  {/snippet}
</Story>

<Story
  name="Remount restores an inline review draft"
  play={async ({ canvas }) => {
    await typeAndRemount(canvas, "Keep this inline draft");
  }}
>
  {#snippet template()}
    <CommunityProjectsReviewDraftHost surface="pull-request-inline" />
  {/snippet}
</Story>
