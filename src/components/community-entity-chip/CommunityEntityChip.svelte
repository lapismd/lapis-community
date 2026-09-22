<script lang="ts">
  import { communityEntityLinkPresentation } from "../../community/community-link-normalize.js";
  import type { CommunityEntityLink } from "../../community/community-links.js";
  import { useCommunityEntityNavigation } from "./navigation.js";
  import CommunityEntityChipFrame from "./CommunityEntityChipFrame.svelte";

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

<CommunityEntityChipFrame
  {text}
  class={className}
  linkKind={presentation.linkKind}
  icon={presentation.icon}
  onclick={() => navigation?.open(link)}
/>
