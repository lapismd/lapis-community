<script lang="ts">
  import { communityEntityLinkPresentation } from "../../community/community-link-normalize.js";
  import type { CommunityEntityLink } from "../../community/community-links.js";
  import CommunityEntityChip from "../community-entity-chip/CommunityEntityChip.svelte";
  import { useCommunityEntityNavigation } from "../community-entity-chip/navigation.js";
  import CommunityComposerRemovableChip from "./CommunityComposerRemovableChip.svelte";

  let {
    link,
    onRemove,
  }: {
    link: CommunityEntityLink;
    onRemove: () => void;
  } = $props();

  const navigation = useCommunityEntityNavigation();
  const presentation = $derived(communityEntityLinkPresentation(link));
  const label = $derived(
    navigation?.label(link) || presentation.fallbackLabel,
  );
</script>

<CommunityComposerRemovableChip {label} {onRemove}>
  <CommunityEntityChip {link} />
</CommunityComposerRemovableChip>
