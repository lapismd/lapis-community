<script lang="ts">
  import type { Snippet } from "svelte";

  import CommunityComposerChipDismiss from "./CommunityComposerChipDismiss.svelte";

  let {
    label,
    onRemove,
    children,
  }: {
    label: string;
    onRemove: () => void;
    children: Snippet;
  } = $props();
</script>

<span
  class="community-composer-removable-token"
  data-ui-part="composer-removable-token"
>
  {@render children()}
  <CommunityComposerChipDismiss {label} {onRemove} />
</span>

<style>
  .community-composer-removable-token {
    display: inline-flex;
    align-items: center;
    gap: 0.08em;
    vertical-align: baseline;
  }
</style>
