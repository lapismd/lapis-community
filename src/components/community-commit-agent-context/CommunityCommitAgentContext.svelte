<script lang="ts">
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import type { NostrEvent } from "../../protocol/index.js";
  import {
    buildRepositoryAgentContexts,
    repositoryAgentContextsForSelection,
  } from "../../projects/repository-agent-context.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsRepositoryAgentContext from "../community-projects/CommunityProjectsRepositoryAgentContext.svelte";
  let {
    events,
    commitId,
    members = [],
    repositoryAddress,
  }: {
    events: readonly NostrEvent[];
    commitId: string;
    members?: readonly CommunityMemberModel[];
    repositoryAddress?: string;
  } = $props();
  let open = $state(false);
  const checkpoints = $derived(
    repositoryAgentContextsForSelection(
      buildRepositoryAgentContexts(events),
      "log",
      commitId,
    ),
  );
  const records = $derived(
    new Set(checkpoints.flatMap((c) => c.records.map((r) => r.id))).size,
  );
  const names = $derived(
    [
      ...new Set(
        checkpoints.map(
          (c) =>
            members.find((m) => m.id === c.authorPubkey)?.name ??
            c.actorName ??
            "Agent",
        ),
      ),
    ].join(", "),
  );
  $effect(() => {
    commitId;
    open = false;
  });
</script>

{#if checkpoints.length}
  <Collapsible.Root
    bind:open
    class="commit-agent-context"
    data-ui-component="community-commit-agent-context"
  >
    <Collapsible.Trigger class="commit-agent-context__trigger">
      {#if open}<ChevronDownIcon aria-hidden="true" />{:else}<ChevronRightIcon
          aria-hidden="true"
        />{/if}
      <span>Agent context</span><span class="commit-agent-context__summary"
        >{names} · {records} entries · {checkpoints[0]?.outcome}</span
      >
    </Collapsible.Trigger>
    <Collapsible.Content>
      <CommunityProjectsRepositoryAgentContext
        {checkpoints}
        {members}
        {...repositoryAddress ? { repositoryAddress } : {}}
      />
    </Collapsible.Content>
  </Collapsible.Root>
{/if}

<style>
  :global(.commit-agent-context) {
    border-block: 1px solid var(--border);
  }
  :global(.commit-agent-context__trigger) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    text-align: start;
    font-size: var(--community-text-secondary);
    font-weight: 600;
  }
  :global(.commit-agent-context__trigger:hover) {
    background: var(--muted);
  }
  :global(.commit-agent-context__trigger:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }
  :global(.commit-agent-context__trigger svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  .commit-agent-context__summary {
    color: var(--muted-foreground);
    font-weight: 400;
  }
</style>
