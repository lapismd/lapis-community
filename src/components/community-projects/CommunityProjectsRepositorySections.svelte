<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";

  import type { ProjectForgeRepository } from "../../projects/index.js";

  let {
    sections,
    empty,
    children,
  }: {
    sections: readonly {
      repository: ProjectForgeRepository;
      count?: number | undefined;
    }[];
    empty: string;
    children: Snippet<[ProjectForgeRepository]>;
  } = $props();

  let open = $state<Record<string, boolean>>({});

  function isOpen(coordinate: string): boolean {
    return open[coordinate] !== false;
  }
</script>

{#if sections.length === 0}
  <p class="community-projects__status">{empty}</p>
{:else}
  <div class="community-projects__collection-groups">
    {#each sections as section (section.repository.address.coordinate)}
      {@const coordinate = section.repository.address.coordinate}
      <Collapsible.Root
        class="community-projects__collection-group"
        open={isOpen(coordinate)}
        onOpenChange={(next) => {
          open = { ...open, [coordinate]: next };
        }}
      >
        <Collapsible.Trigger class="community-projects__list-group-heading">
          <FolderGit2Icon aria-hidden="true" />
          <strong>{section.repository.name}</strong>
          {#if !isOpen(coordinate)}
            <span class="community-projects__list-group-count"
              >{section.count ?? ""}</span
            >
          {/if}
          {#if isOpen(coordinate)}
            <ChevronDownIcon
              class="community-projects__list-group-chevron"
              aria-hidden="true"
            />
          {:else}
            <ChevronRightIcon
              class="community-projects__list-group-chevron"
              aria-hidden="true"
            />
          {/if}
        </Collapsible.Trigger>
        <Collapsible.Content>
          {@render children(section.repository)}
        </Collapsible.Content>
      </Collapsible.Root>
    {/each}
  </div>
{/if}
