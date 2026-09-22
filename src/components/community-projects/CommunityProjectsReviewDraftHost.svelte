<script lang="ts">
  import CommunityProjectsReviewDraftSurface from "./CommunityProjectsReviewDraftSurface.svelte";

  let {
    surface,
  }: {
    surface: "task" | "pull-request" | "pull-request-inline";
  } = $props();

  let remount = $state(0);
</script>

<div>
  <button type="button" onclick={() => (remount += 1)}>Remount</button>
  {#key remount}
    <CommunityProjectsReviewDraftSurface {surface} />
  {/key}
</div>
