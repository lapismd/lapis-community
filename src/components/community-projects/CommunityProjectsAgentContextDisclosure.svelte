<script lang="ts">
  import CommunityAgentContextReferences from "../community-agent-context-references/CommunityAgentContextReferences.svelte";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsRepositoryAgentContext from "./CommunityProjectsRepositoryAgentContext.svelte";

  let {
    checkpoints,
    members = [],
    repositoryAddress,
  }: {
    checkpoints: readonly RepositoryAgentCheckpoint[];
    members?: readonly CommunityMemberModel[];
    repositoryAddress?: string;
  } = $props();
  let open = $state(false);
</script>

<Collapsible.Root
  bind:open
  class="community-projects-agent-context-disclosure"
  data-ui-component="community-projects-agent-context-disclosure"
>
  <div class="community-projects-agent-context-disclosure__header">
    <Collapsible.Trigger
      class="community-projects-agent-context-disclosure__trigger"
    >
      <ChevronRightIcon aria-hidden="true" />
      <span>Agent context</span>
    </Collapsible.Trigger>
    <CommunityAgentContextReferences {checkpoints} {repositoryAddress} />
  </div>
  <Collapsible.Content>
    {#if open}
      <CommunityProjectsRepositoryAgentContext
        {checkpoints}
        showReferenceMenu={false}
        {members}
        {...repositoryAddress ? { repositoryAddress } : {}}
      />
    {/if}
  </Collapsible.Content>
</Collapsible.Root>

<style>
  :global(.community-projects-agent-context-disclosure) {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--background);
  }

  :global(.community-projects-agent-context-disclosure__trigger) {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.75rem;
    text-align: start;
    font-size: var(--community-text-secondary);
    font-weight: 600;
    background: transparent;
  }

  .community-projects-agent-context-disclosure__header {
    display: flex;
    align-items: center;
    padding-inline-end: 0.4rem;
    background: var(--background);
  }

  :global(
      .community-projects__activity-item:hover
        .community-projects-agent-context-disclosure__header
    ),
  :global(
      .community-projects-agent-context-disclosure[data-state="open"]
        .community-projects-agent-context-disclosure__header
    ) {
    background: color-mix(in srgb, var(--muted) 94%, var(--foreground));
  }

  :global(.community-projects-agent-context-disclosure__trigger:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }

  :global(.community-projects-agent-context-disclosure__trigger svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    transition: transform 120ms ease;
  }

  :global(
      .community-projects-agent-context-disclosure__trigger[data-state="open"]
        svg
    ) {
    transform: rotate(90deg);
  }
</style>
