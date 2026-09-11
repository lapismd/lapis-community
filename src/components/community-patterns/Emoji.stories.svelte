<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { CommunityEmojiPicker } from "@lapismd/lapis-community/components";
  import Example from "./examples/EmojiExample.svelte";
  import source from "./examples/EmojiExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Emoji",
    component: CommunityEmojiPicker,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.emoji}
  >{#snippet template()}<Example />{/snippet}</Story
>
