<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import PluginReactionControl from "./PluginReactionControl.svelte";

  const { Story } = defineMeta({
    title: "Community/Registry/Plugin reactions",
    component: PluginReactionControl,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Existing reactions"
  args={{
    summary: [
      { content: "👍", symbol: "👍", count: 18 },
      { content: "❤️", symbol: "❤️", count: 9 },
      { content: "⭐", symbol: "⭐", count: 6 },
    ],
    selected: "⭐",
    releaseAvailable: true,
    hasOwnReaction: true,
    onSubmit: fn(),
  }}
  play={async ({ args, canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Choose plugin reaction" }),
    );
    await userEvent.click(
      within(document.body).getByRole("button", { name: "React 👍" }),
    );
    await expect(canvas.getByLabelText("Selected 👍")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Update reaction" }),
    ).toBeNull();
    await expect(args.onSubmit).toHaveBeenCalledWith("👍");
  }}
/>
