<script lang="ts">
  import type { ComponentProps } from "svelte";

  import CommunityProjectsPullRequestDetailSurface from "./CommunityProjectsPullRequestDetailSurface.svelte";

  let props: ComponentProps<typeof CommunityProjectsPullRequestDetailSurface> =
    $props();
</script>

<CommunityProjectsPullRequestDetailSurface {...props} />
