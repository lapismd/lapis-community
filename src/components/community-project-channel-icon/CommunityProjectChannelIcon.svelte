<script lang="ts">
  import FoldersIcon from "@lucide/svelte/icons/folders";
  import HashIcon from "@lucide/svelte/icons/hash";
  import type { SVGAttributes } from "svelte/elements";

  let props: SVGAttributes<SVGSVGElement> = $props();
</script>

<svg
  {...props}
  data-ui-part="project-channel-icon"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  aria-hidden="true"
>
  <g class="project-channel-folders">
    <FoldersIcon
      size={24}
      style="width: 24px; height: 24px;"
      aria-hidden="true"
    />
  </g>
  <HashIcon
    data-ui-part="channel-hash"
    x="11"
    y="11"
    size={14}
    style="width: 14px; height: 14px;"
    strokeWidth={2.8}
    aria-hidden="true"
  />
</svg>

<style>
  .project-channel-folders {
    clip-path: polygon(0 0, 100% 0, 100% 54%, 54% 54%, 54% 100%, 0 100%);
  }
</style>
