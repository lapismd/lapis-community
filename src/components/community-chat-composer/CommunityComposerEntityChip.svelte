<script lang="ts">
  import { communityEntityLinkPresentation } from "../../community/community-link-normalize.js";
  import type { CommunityEntityLink } from "../../community/community-links.js";
  import CommunityEntityChip from "../community-entity-chip/CommunityEntityChip.svelte";
  import { useCommunityEntityNavigation } from "../community-entity-chip/navigation.js";
  import { composerSlashEntityLabel } from "./composer-slash-labels.js";
  import { readComposerSlashSession } from "./composer-slash-session.js";
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
    composerSlashEntityLabel(link, readComposerSlashSession()) ||
      navigation?.label(link) ||
      presentation.fallbackLabel,
  );
</script>

<CommunityComposerRemovableChip {label} {onRemove}>
  <CommunityEntityChip {link} {label} class="community-composer-token-action" />
</CommunityComposerRemovableChip>
