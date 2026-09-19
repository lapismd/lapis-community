<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import HashIcon from "@lucide/svelte/icons/hash";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import GitGraphIcon from "@lucide/svelte/icons/git-graph";
  import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
  import { useRepositoryLogPane } from "../../projects/repository-log-pane.svelte.js";
  import { useAgentContextNavigation } from "./context.js";
  import { agentContextReferences } from "./references.js";
  import type { AgentContextReference } from "./references.js";
  let {
    checkpoints,
    repositoryAddress,
  }: {
    checkpoints: readonly RepositoryAgentCheckpoint[];
    repositoryAddress?: string | undefined;
  } = $props();
  const navigation = useAgentContextNavigation();
  const logPane = useRepositoryLogPane();
  const references = $derived(
    agentContextReferences(checkpoints, repositoryAddress, navigation),
  );
  const commits = $derived(
    references.filter((reference) => reference.kind === "commit"),
  );
  const otherReferences = $derived(
    references.filter((reference) => reference.kind !== "commit"),
  );
  const icons = {
    commit: GitCommitHorizontalIcon,
    change: GitBranchIcon,
    repository: FolderGit2Icon,
    channel: HashIcon,
    thread: MessagesSquareIcon,
    log: GitGraphIcon,
  };
</script>

{#snippet referenceItem(reference: AgentContextReference)}
  {@const Icon = icons[reference.kind]}
  <DropdownMenu.Item
    disabled={reference.disabled ?? false}
    title={reference.title}
    aria-label={reference.title}
    onSelect={() => {
      if (reference.kind === "log") logPane?.selectPane("log");
      reference.select?.();
    }}
  >
    {#snippet child({ props })}
      {#if reference.href}
        <a {...props} href={reference.href}>
          <Icon data-icon="inline-start" aria-hidden="true" />
          <span class="reference-label">{reference.label}</span>
        </a>
      {:else}
        <div {...props}>
          <Icon data-icon="inline-start" aria-hidden="true" />
          <span class="reference-label">{reference.label}</span>
        </div>
      {/if}
    {/snippet}
  </DropdownMenu.Item>
{/snippet}

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Agent context references"
        title="Agent context references"
      >
        <EllipsisVerticalIcon aria-hidden="true" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    align="end"
    sideOffset={4}
    class="agent-context-reference-menu"
  >
    {#if commits.length}
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>
          <GitCommitHorizontalIcon
            data-icon="inline-start"
            aria-hidden="true"
          />
          <span class="reference-label reference-label--submenu">Commits</span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent
          class="agent-context-reference-menu"
          aria-label="Linked commits"
        >
          {#each commits as reference (reference.key)}
            {@render referenceItem(reference)}
          {/each}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    {/if}
    {#each otherReferences as reference (reference.key)}
      {@render referenceItem(reference)}
    {/each}
    {#if !references.length}
      <DropdownMenu.Item disabled>No references available</DropdownMenu.Item>
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
  :global(.agent-context-reference-menu) {
    width: max-content;
    min-width: min(16rem, calc(100vw - 2rem));
    max-width: min(22rem, calc(100vw - 2rem));
  }
  .reference-label--submenu {
    flex: 1;
    text-align: start;
  }
  .reference-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
