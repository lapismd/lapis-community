<script lang="ts">
  import type { ComponentProps } from "svelte";

  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  import { provideCommunityComposerSlashCatalog } from "./composer-slash-context.js";
  import { composerSlashStoryCatalog } from "./composer-slash-story-catalog.js";

  let props: ComponentProps<typeof CommunityChatComposer> = $props();

  provideCommunityComposerSlashCatalog(() => composerSlashStoryCatalog);
</script>

<CommunityChatComposer {...props} />
