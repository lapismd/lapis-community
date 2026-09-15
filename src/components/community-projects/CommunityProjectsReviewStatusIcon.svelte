<script lang="ts">
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";

  import { REVIEW_GROUP_LABELS } from "./pull-request-review.js";

  let {
    lifecycle,
  }: {
    lifecycle: (typeof REVIEW_GROUP_LABELS)[number]["lifecycle"] | string;
  } = $props();

  const label = $derived(
    REVIEW_GROUP_LABELS.find((group) => group.lifecycle === lifecycle)?.label ??
      lifecycle,
  );
</script>

<span
  class="community-projects__review-status-icon"
  data-status={lifecycle}
  title={label}
>
  {#if lifecycle === "closed"}
    <CircleXIcon aria-hidden="true" />
  {:else if lifecycle === "merged"}
    <GitMergeIcon aria-hidden="true" />
  {:else if lifecycle === "draft"}
    <CircleDashedIcon aria-hidden="true" />
  {:else}
    <CircleIcon aria-hidden="true" />
  {/if}
</span>
