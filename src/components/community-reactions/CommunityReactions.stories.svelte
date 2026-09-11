<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CommunityReactions from "./CommunityReactions.svelte";
  import Example from "../community-patterns/examples/ReactionsExample.svelte";
  import source from "../community-patterns/examples/ReactionsExample.svelte?raw";
  import { contracts } from "../community-patterns/contracts.js";
  const { Story } = defineMeta({
    title: "Community/Primitives/Reactions",
    component: CommunityReactions,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Selection" play={contracts.reactions}
  >{#snippet template()}<Example />{/snippet}</Story
>
