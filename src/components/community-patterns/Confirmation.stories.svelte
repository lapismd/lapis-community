<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { ConfirmButton } from "@lapismd/design-core/forms/dialog";
  import Example from "./examples/ConfirmationExample.svelte";
  import source from "./examples/ConfirmationExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Confirmation",
    component: ConfirmButton,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.confirmation}
  >{#snippet template()}<Example />{/snippet}</Story
>
