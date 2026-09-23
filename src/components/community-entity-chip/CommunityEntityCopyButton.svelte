<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import LinkIcon from "@lucide/svelte/icons/link";

  import { useCommunityShareLink } from "./share-link.js";

  let {
    success = "Link copied",
    label = "",
    href: hrefOverride,
    class: className = "",
  }: { success?: string; label?: string; href?: string; class?: string } =
    $props();
  const share = useCommunityShareLink();
  const href = $derived(hrefOverride || share?.href());
  const named = $derived(label !== "");
</script>

{#if href && share}
  <Button
    type="button"
    variant="ghost"
    {...named ? {} : { size: "icon-sm", "aria-label": success }}
    {...className ? { class: className } : {}}
    title={label || success}
    onclick={() => share.copy(href, success)}
  >
    <LinkIcon
      {...named ? { "data-icon": "inline-start" } : {}}
      aria-hidden="true"
    />
    {#if named}<span>{label}</span>{/if}
  </Button>
{/if}
