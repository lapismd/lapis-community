<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { CommunityMessage } from "@lapismd/lapis-community/components";
  import Example from "./examples/MessageExample.svelte";
  import source from "./examples/MessageExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Message",
    component: CommunityMessage,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.message}
  >{#snippet template()}<Example />{/snippet}</Story
>
