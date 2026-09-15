<script lang="ts">
  import { AppShell } from "@lapismd/design-core/shell";
  import type { ComponentProps } from "svelte";

  import CommunityAgents from "../community-agents/CommunityAgents.svelte";

  type AgentsProps = ComponentProps<typeof CommunityAgents>;

  let {
    agentsAvailable = false,
    adding = $bindable(false),
    model,
    ...agentsProps
  }: Omit<AgentsProps, "model" | "adding"> & {
    agentsAvailable?: boolean;
    adding?: boolean;
    model?: AgentsProps["model"] | undefined;
  } = $props();
</script>

<AppShell.Body layout="regions" label="Agents">
  <AppShell.Body.Content label="Agents directory">
    {#if agentsAvailable && model}
      <CommunityAgents {model} bind:adding {...agentsProps} />
    {:else}
      <div class="community-application__panel-status" role="status">
        Sign in to a community with agent support to view your agents.
      </div>
    {/if}
  </AppShell.Body.Content>
</AppShell.Body>

<style>
  .community-application__panel-status {
    padding: 1rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
  }
</style>
