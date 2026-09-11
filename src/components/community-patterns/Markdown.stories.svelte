<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { CommunityMarkdownContent } from "@lapismd/lapis-community/components";
  import Example from "./examples/MarkdownExample.svelte";
  import source from "./examples/MarkdownExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Markdown",
    component: CommunityMarkdownContent,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.markdown}
  >{#snippet template()}<Example />{/snippet}</Story
>
