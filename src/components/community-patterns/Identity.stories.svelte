<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { CommunityMemberHoverCard } from "@lapismd/lapis-community/components";
  import Example from "./examples/IdentityExample.svelte";
  import source from "./examples/IdentityExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Identity",
    component: CommunityMemberHoverCard,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.identity}
  >{#snippet template()}<Example />{/snippet}</Story
>
