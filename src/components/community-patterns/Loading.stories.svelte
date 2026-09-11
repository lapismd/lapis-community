<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { CommunitySkeleton } from "@lapismd/lapis-community/components";
  import Example from "./examples/LoadingExample.svelte";
  import source from "./examples/LoadingExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Loading",
    component: CommunitySkeleton,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.loading}
  >{#snippet template()}<Example />{/snippet}</Story
>
<Story name="Empty" play={contracts.loadingEmpty}
  >{#snippet template()}<Example outcome="empty" />{/snippet}</Story
>
<Story name="Error and retry" play={contracts.loadingError}
  >{#snippet template()}<Example outcome="error" />{/snippet}</Story
>
