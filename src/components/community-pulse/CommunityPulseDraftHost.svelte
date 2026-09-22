<script lang="ts">
  import { fn } from "storybook/test";

  import type { CommunityPulseModel } from "../../community/index.js";
  import CommunityPulse from "./CommunityPulse.svelte";

  const currentMember = {
    id: "story-pulse-member",
    name: "Steve",
    handle: "@steve",
    initials: "SJ",
    presence: "online" as const,
  };
  const model: CommunityPulseModel = {
    tab: "everyone",
    status: "ready",
    notes: [],
    agentActivities: [],
    members: [currentMember],
    canDirectMessage: false,
  };

  let remount = $state(0);
</script>

<div>
  <button type="button" onclick={() => (remount += 1)}>Remount</button>
  {#key remount}
    <CommunityPulse
      {model}
      {currentMember}
      onPublish={fn(async () => {})}
    />
  {/key}
</div>
