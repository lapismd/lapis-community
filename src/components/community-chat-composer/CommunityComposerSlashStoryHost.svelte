<script lang="ts">
  import type { ComponentProps } from "svelte";

  import { communityEntityLinkLabel } from "../../community/community-link-normalize.js";
  import { provideCommunityEntityNavigation } from "../community-entity-chip/navigation.js";
  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  import { provideCommunityComposerSlashCatalog } from "./composer-slash-context.js";
  import { composerSlashEntityLabel } from "./composer-slash-labels.js";
  import { publishComposerSlashSession } from "./composer-slash-session.js";
  import { composerSlashStoryCatalog } from "./composer-slash-story-catalog.js";

  let props: ComponentProps<typeof CommunityChatComposer> = $props();

  publishComposerSlashSession(composerSlashStoryCatalog);
  provideCommunityComposerSlashCatalog(() => composerSlashStoryCatalog);
  provideCommunityEntityNavigation({
    open: () => {},
    label: (link) =>
      composerSlashEntityLabel(link, composerSlashStoryCatalog) ??
      communityEntityLinkLabel(link, composerSlashStoryCatalog.rooms),
  });
</script>

<CommunityChatComposer {...props} />
