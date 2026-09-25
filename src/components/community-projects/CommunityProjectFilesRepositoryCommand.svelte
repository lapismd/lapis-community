<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import XIcon from "@lucide/svelte/icons/x";

  import type { ProjectForgeRepository } from "../../projects/index.js";

  let {
    repositories = [],
    selectedRepository,
    onSelectRepository,
  }: {
    repositories?: readonly ProjectForgeRepository[] | undefined;
    selectedRepository?: ProjectForgeRepository | undefined;
    onSelectRepository?:
      | ((repository: ProjectForgeRepository) => void)
      | undefined;
  } = $props();

  let open = $state(false);
  let query = $state("");

  const selected = $derived(selectedRepository ?? repositories[0]);

  function label(repository: ProjectForgeRepository | undefined): string {
    return repository?.name || repository?.address.identifier || "Repository";
  }

  function handleOpen(next: boolean): void {
    open = next;
    if (next) query = "";
  }

  function choose(repository: ProjectForgeRepository): void {
    handleOpen(false);
    if (repository.address.coordinate === selected?.address.coordinate) return;
    onSelectRepository?.(repository);
  }
</script>

<Popover.Root {open} onOpenChange={handleOpen}>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        type="button"
        variant="outline"
        class={["community-projects__files-repository-trigger", props.class]}
        role="combobox"
        aria-label="Project files repository"
        disabled={repositories.length === 0}
      >
        <FolderGit2Icon aria-hidden="true" />
        <span>{label(selected)}</span>
        <ChevronDownIcon aria-hidden="true" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content
    class="community-projects__files-repository-command"
    align="end"
    style="--ui-popover-width: 22rem; --ui-popover-padding: 0.5rem 0.75rem 0.625rem; --ui-popover-gap: 0.25rem"
  >
    <Popover.Header class="community-projects__files-repository-command-header">
      <Popover.Title
        class="community-projects__files-repository-command-title"
        role="heading"
        aria-level={2}>Select repository</Popover.Title
      >
      <Popover.Close>
        {#snippet child({ props })}
          <Button
            {...props}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close repository selector"
          >
            <XIcon aria-hidden="true" />
          </Button>
        {/snippet}
      </Popover.Close>
    </Popover.Header>
    <CommandView.Root label="Select repository">
      <CommandView.Input
        bind:value={query}
        placeholder="Search repositories"
        aria-label="Search repositories"
      />
      <CommandView.List>
        <CommandView.Empty>No matching repositories.</CommandView.Empty>
        <CommandView.Group heading="Project repositories">
          {#each repositories as repository (repository.address.coordinate)}
            <CommandView.Item
              value={`${repository.name} ${repository.address.identifier} ${repository.address.coordinate}`}
              onSelect={() => choose(repository)}
            >
              <CommandView.ItemIcon>
                {#if repository.address.coordinate === selected?.address.coordinate}
                  <CheckIcon aria-hidden="true" />
                {/if}
              </CommandView.ItemIcon>
              <CommandView.ItemLabel>{label(repository)}</CommandView.ItemLabel>
              <CommandView.ItemDescription>
                {repository.description || repository.address.coordinate}
              </CommandView.ItemDescription>
            </CommandView.Item>
          {/each}
        </CommandView.Group>
      </CommandView.List>
    </CommandView.Root>
  </Popover.Content>
</Popover.Root>

<style>
  :global(
      .community-projects__files-repository-command-header[data-ui-part="popover-header"]
    ) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    min-height: 0;
    margin: 0;
    padding: 0;
  }

  :global(
      .community-projects__files-repository-command-title[data-ui-part="popover-title"]
    ) {
    margin: 0;
    font-weight: var(--font-weight-bold, 700);
    line-height: 1.2;
  }

  :global(
      .community-projects__files-repository-command[data-ui-part="popover-content"]
    ) {
    --ui-command-view-list-max-height: min(18rem, 50dvh);
    --ui-command-view-list-padding: 0.25rem;
    --ui-command-view-gap: 0.25rem;
  }
</style>
