<script lang="ts">
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import {
    activityRunLabel,
    activityStreams,
  } from "../community-agent-activity/activity-run-label.js";

  let { state }: { state?: string } = $props();
</script>

<Reasoning label={activityRunLabel(state)} streaming={activityStreams(state)} />
