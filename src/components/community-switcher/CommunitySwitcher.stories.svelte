<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";

  import { communityStoryCommunities } from "../community-workspace/story-fixtures.js";
  import CommunitySwitcher from "./CommunitySwitcher.svelte";

  const { Story } = defineMeta({
    title: "Community/Navigation/Community Switcher",
    component: CommunitySwitcher,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Labelled community list"
  args={{
    communities: communityStoryCommunities,
    activeCommunityId: "lapis",
    onSelect: fn(),
  }}
/>

<Story
  name="Compact community rail"
  args={{
    communities: communityStoryCommunities,
    activeCommunityId: "lapis",
    compact: true,
    onSelect: fn(),
  }}
/>
