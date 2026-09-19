<script lang="ts">
  import type { Snippet } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";

  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import {
    projectMemberRepositories,
    type ProjectForgeRepository,
  } from "../../projects/index.js";

  let {
    repositories,
    references = repositories.map((repository) => repository.address),
    selectedCoordinate = "",
    channelName,
    sourceLabel,
    plus,
    onSelectRepository,
    onSelectChannel,
  }: {
    repositories: readonly ProjectForgeRepository[];
    references?: readonly { coordinate: string }[] | undefined;
    selectedCoordinate?: string | undefined;
    channelName: (repository: ProjectForgeRepository) => string;
    sourceLabel?: ((repository: ProjectForgeRepository) => string) | undefined;
    plus?: Snippet | undefined;
    onSelectRepository: (repository: ProjectForgeRepository) => void;
    onSelectChannel: (repository: ProjectForgeRepository) => void;
  } = $props();

  const members = $derived(projectMemberRepositories(repositories, references));
  let open = $state<Record<string, boolean>>({});

  function isOpen(coordinate: string): boolean {
    return open[coordinate] !== false;
  }
</script>

{#if members.length > 0 || plus}
  <div class="community-projects-project-repositories-rail__heading">
    <p class="community-application__project-overview-label">Repositories</p>
    {@render plus?.()}
  </div>
  {#each members as repository (repository.address.coordinate)}
    {@const coordinate = repository.address.coordinate}
    {@const name = channelName(repository)}
    <Collapsible.Root
      class="community-projects-project-repositories-rail"
      open={isOpen(coordinate)}
      onOpenChange={(next) => {
        open = { ...open, [coordinate]: next };
      }}
    >
      <div
        class="community-projects-project-repositories-rail__row"
        data-active={selectedCoordinate === coordinate ? "" : undefined}
      >
        <Button
          type="button"
          variant="ghost"
          class="community-projects-project-repositories-rail__repository"
          aria-current={selectedCoordinate === coordinate ? "page" : undefined}
          title={repository.name}
          onclick={() => onSelectRepository(repository)}
        >
          <FolderGit2Icon data-icon="inline-start" aria-hidden="true" />
          <span>{repository.name}</span>
          {#if sourceLabel}
            <span class="community-application__project-overview-count"
              >{sourceLabel(repository)}</span
            >
          {/if}
        </Button>
        <Collapsible.Trigger
          class="community-projects-project-repositories-rail__toggle"
          aria-label={`${isOpen(coordinate) ? "Collapse" : "Expand"} ${repository.name}`}
        >
          {#if isOpen(coordinate)}
            <ChevronDownIcon size={14} aria-hidden="true" />
          {:else}
            <ChevronRightIcon size={14} aria-hidden="true" />
          {/if}
        </Collapsible.Trigger>
      </div>
      <Collapsible.Content>
        {#if name}
          <div class="community-projects-project-repositories-rail__children">
            <Button
              type="button"
              variant="ghost"
              class="community-application__project-overview-item community-projects-project-repositories-rail__channel"
              onclick={() => onSelectChannel(repository)}
            >
              <CommunityProjectChannelIcon data-icon="inline-start" />
              <span>{name}</span>
            </Button>
          </div>
        {/if}
      </Collapsible.Content>
    </Collapsible.Root>
  {/each}
{/if}

<style>
  .community-projects-project-repositories-rail__heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    margin: 0.9rem 0 0.3rem;
    padding-inline: 0.4rem;
  }

  .community-application__project-overview-label {
    margin: 0;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-projects-project-repositories-rail__heading
    :global(> [data-ui-component="button"]) {
    width: 1.75rem;
    min-width: 1.75rem;
    height: 1.75rem;
    min-height: 1.75rem;
    margin-inline-end: -0.4rem;
  }

  .community-projects-project-repositories-rail__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 1.5rem;
    align-items: center;
    border-radius: 0.375rem;
  }

  .community-projects-project-repositories-rail__row[data-active],
  .community-projects-project-repositories-rail__row:hover {
    background-color: color-mix(
      in oklab,
      var(--muted-foreground) 10%,
      transparent
    );
  }

  .community-projects-project-repositories-rail__children {
    padding-inline-start: 1.25rem;
  }

  :global(
      .community-application__project-overview-item.community-projects-project-repositories-rail__channel[data-ui-component="button"]
    ) {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  :global(
      .community-projects-project-repositories-rail__channel[data-ui-component="button"]
        > svg
    ) {
    width: 0.8125rem;
    height: 0.8125rem;
  }

  :global(
      .community-projects-project-repositories-rail__repository[data-ui-component="button"]
    ) {
    display: grid;
    min-width: 0;
    width: 100%;
    height: 1.75rem;
    grid-template-columns: 0.875rem minmax(0, 1fr) auto;
    justify-content: stretch;
    gap: 0.5rem;
    padding-inline: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
    font-weight: 400;
    line-height: 1.25rem;
    text-align: start;
    background-color: transparent;
  }

  :global(
      .community-projects-project-repositories-rail__repository[data-ui-component="button"]
        > svg
    ) {
    width: 0.875rem;
    height: 0.875rem;
  }

  :global(
      .community-projects-project-repositories-rail__repository[data-ui-component="button"]
        > span
    ) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(
      .community-projects-project-repositories-rail__repository[data-ui-component="button"]:hover:not(
          :disabled
        )
    ),
  :global(
      .community-projects-project-repositories-rail__repository[data-ui-component="button"]:focus-visible
    ) {
    background-color: transparent;
  }

  :global(.community-projects-project-repositories-rail__toggle) {
    display: inline-flex;
    justify-self: center;
    width: 1.25rem;
    height: 1.25rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 999px;
    padding: 0;
    color: var(--muted-foreground);
    background: transparent;
  }

  :global(.community-projects-project-repositories-rail__toggle:hover),
  :global(.community-projects-project-repositories-rail__toggle:focus-visible) {
    background-color: color-mix(
      in oklab,
      var(--muted-foreground) 22%,
      transparent
    );
  }

  :global(.community-projects-project-repositories-rail__toggle svg) {
    width: 0.875rem;
    height: 0.875rem;
  }

  :global(
      .community-application__project-overview-item[data-ui-component="button"][data-active]
    ),
  :global(
      .community-application__project-overview-item[data-ui-component="button"]:hover:not(
          :disabled
        )
    ) {
    color: var(--muted-foreground);
    background-color: color-mix(in oklab, currentColor 10%, transparent);
  }

  :global(.community-application__project-overview-count:empty) {
    display: none;
  }
</style>
