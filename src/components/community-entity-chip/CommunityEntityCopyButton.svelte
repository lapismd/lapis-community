<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import LinkIcon from "@lucide/svelte/icons/link";

  import { useCommunityShareLink } from "./share-link.js";

  let { success = "Link copied" }: { success?: string } = $props();
  const share = useCommunityShareLink();
  const href = $derived(share?.href());
</script>

{#if href && share}
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    aria-label={success}
    title={success}
    onclick={() => share.copy(href, success)}
  >
    <LinkIcon aria-hidden="true" />
  </Button>
{/if}
