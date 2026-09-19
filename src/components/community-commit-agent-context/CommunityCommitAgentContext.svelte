<script lang="ts">
  import CommunityCommitSection from "../community-commit-section/CommunityCommitSection.svelte";
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
  <CommunityCommitSection title="Agent context" bind:open>
    {#snippet summary()}
      {names} · {records} entries · {checkpoints[0]?.outcome}
    {/snippet}
    <CommunityProjectsRepositoryAgentContext
      {checkpoints}
      {members}
      {...repositoryAddress ? { repositoryAddress } : {}}
    />
  </CommunityCommitSection>
{/if}
