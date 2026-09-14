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

<script lang="ts">
  let fallbackAvatar = $state("");
</script>

<Story name="Selection" play={contracts.avatar}
  >{#snippet template()}<Example />{/snippet}</Story
>

<Story name="Name fallback"
  >{#snippet template()}<CommunityAvatarPicker
      bind:value={fallbackAvatar}
      label="Choose agent image"
      fallbackName="Nyra"
    />{/snippet}</Story
>
