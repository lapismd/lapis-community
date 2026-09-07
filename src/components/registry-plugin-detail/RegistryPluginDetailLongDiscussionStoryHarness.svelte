<script lang="ts">
  import { registryStoryResolvedDetail } from "../registry-browser/story-fixtures.js";
  import RegistryCommunityLongTimelineStoryHarness from "../registry-community/RegistryCommunityLongTimelineStoryHarness.svelte";
  import RegistryPluginDetail from "./RegistryPluginDetail.svelte";

  const resolved = registryStoryResolvedDetail();
  let outcome = $state("No registry action selected");
</script>

<RegistryPluginDetail
  {resolved}
  related={[]}
  onOpenPlugin={(plugin) => (outcome = `Opened ${plugin.name}`)}
  onOpenCategory={(category) => (outcome = `Filtered by ${category}`)}
  onOpenPlatform={(platform) => (outcome = `Filtered by ${platform}`)}
  onSelectVersion={(version) => (outcome = `Selected ${version}`)}
>
  {#snippet discussion()}
    <RegistryCommunityLongTimelineStoryHarness
      namespace="stable-timeline-detail"
      latencyMs={250}
    />
  {/snippet}
</RegistryPluginDetail>

<p class="registry-plugin-detail-story__outcome" role="status">{outcome}</p>
