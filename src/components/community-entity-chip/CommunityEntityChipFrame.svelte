<script lang="ts">
  import type {
    CommunityEntityLinkIcon,
    CommunityEntityLinkKindAttr,
  } from "../../community/community-links.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityEntityChipIcon from "./CommunityEntityChipIcon.svelte";
  import "./community-entity-link.css";

  let {
    text,
    class: className = "",
    linkKind,
    icon,
    onclick,
  }: {
    text: string;
    class?: string;
    linkKind: CommunityEntityLinkKindAttr;
    icon: CommunityEntityLinkIcon;
    onclick: () => void;
  } = $props();
</script>

<CommunityChip
  class={`community-entity-link ${className}`.trim()}
  variant="muted"
  size="inline"
  title={text}
  ariaLabel={text}
  buttonProps={{ "data-link-kind": linkKind }}
  {onclick}
>
  {#snippet leading()}
    <CommunityEntityChipIcon {icon} />
  {/snippet}
  <span class="community-entity-label">{text}</span>
</CommunityChip>
