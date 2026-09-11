<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CommunityMemberAvatarGroup from "./CommunityMemberAvatarGroup.svelte";
  import Example from "../community-patterns/examples/IdentityExample.svelte";
  import source from "../community-patterns/examples/IdentityExample.svelte?raw";
  import { contracts } from "../community-patterns/contracts.js";
  const { Story } = defineMeta({
    title: "Community/Members/Avatar Group",
    component: CommunityMemberAvatarGroup,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "tsx" } } },
  });
</script>

<Story name="Shared identity actions" play={contracts.identity}
  >{#snippet template()}<Example />{/snippet}</Story
>
