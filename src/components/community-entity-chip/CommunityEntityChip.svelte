<script lang="ts">
  import { communityEntityLinkPresentation } from "../../community/community-link-normalize.js";
  import type { CommunityEntityLink } from "../../community/community-links.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityEntityChipIcon from "./CommunityEntityChipIcon.svelte";
  import { useCommunityEntityNavigation } from "./navigation.js";

  let {
    link,
    label,
    class: className = "",
  }: {
    link: CommunityEntityLink;
    label?: string;
    class?: string;
  } = $props();

  const navigation = useCommunityEntityNavigation();
  const presentation = $derived(communityEntityLinkPresentation(link));
  const text = $derived(
    label?.trim() || navigation?.label(link) || presentation.fallbackLabel,
  );
</script>

<CommunityChip
  class={className}
  variant="muted"
  size="inline"
  ariaLabel={text}
  buttonProps={{ "data-link-kind": presentation.linkKind }}
  onclick={() => navigation?.open(link)}
>
  {#snippet leading()}
    <CommunityEntityChipIcon icon={presentation.icon} />
  {/snippet}
  {text}
</CommunityChip>
