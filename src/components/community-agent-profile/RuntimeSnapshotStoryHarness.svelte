<script lang="ts">
  import { untrack } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityAgentProfile from "./CommunityAgentProfile.svelte";
  import {
    storyAgent,
    storyAgentRooms,
    storyAgentRuntime,
  } from "../community-agents/story-fixtures.js";
  import type { CommunityRuntimeRefreshState } from "../../community/agent-runtime-snapshot-protocol.js";
  let {
    scenario = "pending",
  }: { scenario?: "pending" | "timeout" | "incoming" } = $props();
  let runtime = $state(storyAgentRuntime);
  let status = $state<CommunityRuntimeRefreshState>(
    untrack(() => ({
      status: scenario === "timeout" ? "timed-out" : "pending",
      observedAt: 1800000000000,
      revision: 1,
    })),
  );
  const noop = async () => {};
  function incoming() {
    runtime = {
      ...runtime,
      host: { ...runtime.host, id: "updated-workspace" },
    };
    status = { status: "completed", observedAt: 1800000060000, revision: 2 };
  }
</script>

<div class="community-ui">
  {#if scenario === "timeout"}<Button
      onclick={() => {
        status = { ...status, status: "timed-out" };
      }}>Simulate timeout</Button
    >{/if}
  {#if scenario === "incoming"}<Button onclick={incoming}
      >Receive new snapshot</Button
    >{/if}
  <CommunityAgentProfile
    agent={storyAgent}
    rooms={storyAgentRooms}
    {runtime}
    runtimeRefresh={status}
    onRefreshRuntime={async () => {
      status = { ...status, status: "pending" };
    }}
    onMessage={noop}
    onFollow={noop}
    onActivity={noop}
    onCopy={noop}
    onOpenChannel={noop}
    onAddChannel={noop}
    onRemoveChannel={noop}
    onSaveAgent={noop}
    onUnlinkPersona={noop}
    onDeletePersona={noop}
  />
</div>
