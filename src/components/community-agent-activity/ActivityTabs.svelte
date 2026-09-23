<script lang="ts">
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import type { Snippet } from "svelte";
  import "./activity-tabs.css";

  let { turns, activity }: { turns: Snippet; activity: Snippet } = $props();
  let panel = $state("activity");
</script>

<Tabs.Root bind:value={panel} class="activity-sections">
  <Tabs.List aria-label="Activity sections">
    <Tabs.Trigger value="turns">Turns</Tabs.Trigger>
    <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="turns" class="activity-panel activity-panel--turns"
    >{@render turns()}</Tabs.Content
  >
  <Tabs.Content value="activity" class="activity-panel activity-panel--history"
    >{@render activity()}</Tabs.Content
  >
</Tabs.Root>
