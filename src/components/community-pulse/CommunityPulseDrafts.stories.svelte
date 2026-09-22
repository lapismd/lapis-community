<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import CommunityPulse from "./CommunityPulse.svelte";
  import CommunityPulseDraftHost from "./CommunityPulseDraftHost.svelte";

  const { Story } = defineMeta({
    title: "Community/Pulse/Pulse drafts",
    component: CommunityPulse,
    tags: ["visual-pending"],
    parameters: {
      layout: "padded",
      docs: {
        source: {
          code: `<CommunityPulse
  {model}
  {currentMember}
  onPublish={publishNote}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Remount restores a Pulse draft"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open Pulse composer" }),
    );
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "Keep this pulse draft");
    await waitFor(() => {
      expect(editor).toHaveTextContent("Keep this pulse draft");
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 300);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Remount" }));
    await userEvent.click(
      await canvas.findByRole("button", { name: "Open Pulse composer" }),
    );
    const restored = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() => {
      expect(restored).toHaveTextContent("Keep this pulse draft");
    });
  }}
>
  {#snippet template()}
    <CommunityPulseDraftHost />
  {/snippet}
</Story>
