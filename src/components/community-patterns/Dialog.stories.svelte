<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import Example from "./examples/DialogExample.svelte";
  import source from "./examples/DialogExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Dialog",
    component: DialogFrame,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.dialog}
  >{#snippet template()}<Example />{/snippet}</Story
>
