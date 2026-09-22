<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";
  import {
    playChannelEntityHashes,
    playRepositoryLogCopyLink,
  } from "./application-entity-links-play.js";

  const { Story } = defineMeta({
    title: "Community/Examples/Entity Links",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: { layout: "fullscreen", communityAppShell: true },
  });
</script>

<Story
  name="Channel and thread hashes follow location"
  play={playChannelEntityHashes}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness namespace="entity-links-channels" />
  {/snippet}
</Story>

<Story
  name="Repository Log and Op Log copy-link"
  play={playRepositoryLogCopyLink}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="entity-links-oplog"
      projects
      initialDestination="projects"
    />
  {/snippet}
</Story>
