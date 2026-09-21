<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import Harness from "./CommunityAgentActivityScrollHarness.svelte";
  import { playActivityScrollToLatest } from "./activity-scroll-story.js";
  const { Story } = defineMeta({
    title: "Community/Agents/Activity",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityAgentActivity } from "@lapismd/lapis-community/components";
<\/script>
<CommunityAgentActivity {model} onLatest={refreshActivity} onLoadOlder={loadOlder} onClearHistory={clearHistory} />`,
        },
      },
    },
  });
</script>

<Story name="Scroll to latest" play={playActivityScrollToLatest}>
  {#snippet template()}<Harness />{/snippet}
</Story>
