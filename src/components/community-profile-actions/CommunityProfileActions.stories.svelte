<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CommunityProfileActions from "./CommunityProfileActions.svelte";
  import Example from "../community-patterns/examples/ProfileActionsExample.svelte";
  import source from "../community-patterns/examples/ProfileActionsExample.svelte?raw";
  import { playProfileActionsContract } from "./profile-actions-contract.js";
  const { Story } = defineMeta({
    title: "Community/Patterns/Profile actions",
    component: CommunityProfileActions,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "svelte" } } },
  });
</script>

<Story
  name="Contract"
  play={async ({ canvas }) => playProfileActionsContract(canvas)}
>
  {#snippet template()}<Example />{/snippet}
</Story>
