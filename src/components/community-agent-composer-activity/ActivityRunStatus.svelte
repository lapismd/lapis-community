<script lang="ts">
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import {
    activityRunLabel,
    activityStreams,
  } from "../community-agent-activity/activity-run-label.js";

  let { state, preview }: { state?: string; preview?: string } = $props();
</script>

<Reasoning
  label={activityRunLabel(state, preview)}
  streaming={activityStreams(state)}
/>
