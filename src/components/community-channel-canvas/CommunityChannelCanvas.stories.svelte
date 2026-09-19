<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";
  import CommunityChannelCanvas from "./CommunityChannelCanvas.svelte";
  import { staleCanvasContract } from "./canvas-story-contracts.js";
  import Example from "../community-patterns/examples/CanvasExample.svelte";
  import source from "../community-patterns/examples/CanvasExample.svelte?raw";
  const canvas = {
    roomId: "project",
    groupId: "project",
    content:
      "# Project context\n\nShared **Markdown** notes from Buzz.\n\n- Ship the first version\n- Review together",
    eventId: "head",
    author: "author",
    updatedAt: 100,
    loading: false,
    canEdit: true,
  };
  const { Story } = defineMeta({
    title: "Community/Channels/Canvas",
    component: CommunityChannelCanvas,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: source,
        },
      },
    },
    args: { canvas, onSave: fn(), onReload: fn() },
  });
</script>

<Story name="Stale edit review" play={staleCanvasContract}
  >{#snippet template()}<Example />{/snippet}</Story
>

<Story
  name="Existing Buzz canvas"
  play={async ({ canvas: view }) => {
    await expect(
      view.getByRole("heading", { name: "Project context" }),
    ).toBeVisible();
    await expect(
      view.getByRole("button", { name: "Edit canvas" }),
    ).toBeVisible();
  }}
/>
<Story
  name="Empty"
  args={{
    canvas: {
      ...canvas,
      content: "",
      eventId: null,
      author: null,
      updatedAt: null,
    },
    initialContent:
      "# Project channel: Community Client\n\nAsk the configured agent to keep this canvas current.",
  }}
  play={async ({ canvas: view, args }) => {
    await userEvent.click(view.getByRole("button", { name: "Create canvas" }));
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(
      view.getByRole("button", { name: "Save canvas" }),
    ).toBeVisible();
    await expect(
      view.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveTextContent("Project channel: Community Client");
    await userEvent.click(view.getByRole("button", { name: "Cancel" }));
    await expect(
      view.getByRole("button", { name: "Create canvas" }),
    ).toBeVisible();
    await userEvent.click(view.getByRole("button", { name: "Create canvas" }));
    await userEvent.click(view.getByRole("button", { name: "Save canvas" }));
    await expect(args.onSave).toHaveBeenCalledWith(
      "# Project channel: Community Client\n\nAsk the configured agent to keep this canvas current.",
      null,
    );
  }}
/>
<Story
  name="Rejected save retains draft"
  args={{
    onSave: fn().mockRejectedValue(new Error("Relay rejected the canvas")),
  }}
  play={async ({ canvas: view, args }) => {
    args.onSave.mockRejectedValue(new Error("Relay rejected the canvas"));
    await userEvent.click(view.getByRole("button", { name: "Edit canvas" }));
    await userEvent.click(view.getByRole("button", { name: "Save canvas" }));
    await expect(view.getByRole("alert")).toHaveTextContent(
      "Relay rejected the canvas",
    );
    await expect(
      view.getByRole("button", { name: "Save canvas" }),
    ).toBeEnabled();
    await expect(args.onSave).toHaveBeenCalledWith(canvas.content, "head");
  }}
/>
<Story
  name="Archived read only"
  args={{ canvas: { ...canvas, canEdit: false } }}
  play={async ({ canvas: view }) => {
    await expect(
      view.queryByRole("button", { name: "Edit canvas" }),
    ).not.toBeInTheDocument();
    await expect(
      view.getByRole("heading", { name: "Project context" }),
    ).toBeVisible();
  }}
/>
<Story
  name="Initial loading"
  args={{
    canvas: {
      ...canvas,
      content: "",
      eventId: null,
      loading: true,
      canEdit: false,
    },
  }}
/>
<Story
  name="Refresh preserves content"
  args={{ canvas: { ...canvas, loading: true } }}
/>
