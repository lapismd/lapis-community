<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { CommunityAvatarPicker } from "@lapismd/lapis-community/components";
  import Example from "./examples/AvatarExample.svelte";
  import source from "./examples/AvatarExample.svelte?raw";
  import { contracts } from "./contracts.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Avatar",
    component: CommunityAvatarPicker,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Contract" play={contracts.avatar}
  >{#snippet template()}<Example />{/snippet}</Story
>
