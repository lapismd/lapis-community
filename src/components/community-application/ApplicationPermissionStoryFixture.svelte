<script lang="ts">
  import { tick } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import type { CommunityTestRuntime } from "../../testing/community-test-runtime.js";
  import type { CommunityController } from "../../community/contracts.js";
  import {
    publishStoryActivity,
    storyPermission,
  } from "../../testing/application-permission-fixture.js";
  let {
    runtime,
    controller,
    mounted = $bindable(true),
  }: {
    runtime: CommunityTestRuntime;
    controller: CommunityController;
    mounted?: boolean;
  } = $props();
  let sent = $state(0);
  async function send(kind: string, expiresIn = 60000) {
    await publishStoryActivity(runtime, kind, storyPermission(expiresIn));
    sent += 1;
  }
  async function remount() {
    mounted = false;
    await tick();
    mounted = true;
  }
</script>

<div role="group" aria-label="Permission fixture controls">
  <Button
    disabled={controller.state.agents?.status !== "ready"}
    onclick={() => send("permission_requested")}>Request permission</Button
  >
  <Button onclick={() => send("permission_resolved")}>Resolve permission</Button
  >
  <Button onclick={() => send("permission_requested", 2000)}
    >Request expiring permission</Button
  >
  <Button onclick={remount}>Remount application</Button>
  <span role="status">Fixture frames sent: {sent}</span>
</div>
