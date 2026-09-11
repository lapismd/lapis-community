<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { CommunityReactions } from "@lapismd/lapis-community/components";
  import Example from "./examples/ReactionsExample.svelte";
  import source from "./examples/ReactionsExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Reactions",
    component: CommunityReactions,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.reactions}
  >{#snippet template()}<Example />{/snippet}</Story
>
