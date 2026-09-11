<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CommunityAvatarPicker from "./CommunityAvatarPicker.svelte";
  import Example from "../community-patterns/examples/AvatarExample.svelte";
  import source from "../community-patterns/examples/AvatarExample.svelte?raw";
  import { contracts } from "../community-patterns/contracts.js";
  const { Story } = defineMeta({
    title: "Community/Primitives/Avatar",
    component: CommunityAvatarPicker,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Selection" play={contracts.avatar}
  >{#snippet template()}<Example />{/snippet}</Story
>
