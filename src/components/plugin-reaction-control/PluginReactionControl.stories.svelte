<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import { noop } from "../story-fixtures.js";
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
    onSubmit: noop,
  }}
/>
