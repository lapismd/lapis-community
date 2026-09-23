<script lang="ts">
  import type { ComponentProps } from "svelte";

  import CommunityProjectsPullRequestDetailSurface from "./CommunityProjectsPullRequestDetailSurface.svelte";

  let {
    descriptionOpen = $bindable(true),
    filesOpen = $bindable(false),
    commitsOpen = $bindable(false),
    checksOpen = $bindable(false),
    activityOpen = $bindable(true),
    fileListOpen = $bindable(true),
    fileFilter = $bindable(""),
    fileListMode = $bindable("tree"),
    selectedPath = $bindable(""),
    collapsedPaths = $bindable([]),
    viewedPaths = $bindable([]),
    viewMode = $bindable("unified"),
    scrollTarget = $bindable(null),
    inlineContent = $bindable(""),
    comment = $bindable(""),
    ...props
  }: ComponentProps<
    typeof CommunityProjectsPullRequestDetailSurface
  > = $props();
</script>

<CommunityProjectsPullRequestDetailSurface
  {...props}
  bind:descriptionOpen
  bind:filesOpen
  bind:commitsOpen
  bind:checksOpen
  bind:activityOpen
  bind:fileListOpen
  bind:fileFilter
  bind:fileListMode
  bind:selectedPath
  bind:collapsedPaths
  bind:viewedPaths
  bind:viewMode
  bind:scrollTarget
  bind:inlineContent
  bind:comment
/>
