<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { CommunityChatComposer } from "@lapismd/lapis-community/components";
  import Example from "./examples/ComposerExample.svelte";
  import source from "./examples/ComposerExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Composer",
    component: CommunityChatComposer,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.composer}
  >{#snippet template()}<Example />{/snippet}</Story
>
