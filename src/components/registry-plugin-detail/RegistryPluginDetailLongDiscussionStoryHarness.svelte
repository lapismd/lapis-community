<script lang="ts">
  import { registryStoryResolvedDetail } from "../registry-browser/story-fixtures.js";
  import RegistryCommunityLongTimelineStoryHarness from "../registry-community/RegistryCommunityLongTimelineStoryHarness.svelte";
  import RegistryPluginDetail from "./RegistryPluginDetail.svelte";

  const resolved = registryStoryResolvedDetail();
</script>

<RegistryPluginDetail {resolved} related={[]}>
  {#snippet discussion()}
    <RegistryCommunityLongTimelineStoryHarness
      namespace="stable-timeline-detail"
      latencyMs={250}
    />
  {/snippet}
</RegistryPluginDetail>
