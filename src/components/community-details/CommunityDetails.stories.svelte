<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import {
    communityStoryDetails,
    communityStoryMembers,
    communityStoryNavigation,
  } from "../community-workspace/story-fixtures.js";
  import CommunityDetails from "./CommunityDetails.svelte";

  const supportRoom = communityStoryNavigation[1]!.rooms[0]!;

  const { Story } = defineMeta({
    title: "Community/Channels/Details",
    component: CommunityDetails,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Forum details and members"
  args={{
    room: supportRoom,
    details: communityStoryDetails,
    members: communityStoryMembers,
  }}
/>
