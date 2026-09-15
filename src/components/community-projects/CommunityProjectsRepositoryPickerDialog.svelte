<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";

  import type {
    ProjectForgeProject,
    ProjectForgeRepository,
  } from "../../projects/index.js";

  let {
    open = $bindable(false),
    step = $bindable("repository"),
    coordinate = $bindable(""),
    repositories = [],
    projects = [],
    localError = "",
    onSelectRepository,
    onBack,
    onSelectProject,
  }: {
    open?: boolean | undefined;
    step?: "repository" | "project" | undefined;
    coordinate?: string | undefined;
    repositories?: readonly ProjectForgeRepository[] | undefined;
    projects?: readonly ProjectForgeProject[] | undefined;
    localError?: string | undefined;
    onSelectRepository: (repository: ProjectForgeRepository) => void;
    onBack: () => void;
    onSelectProject: (projectCoordinate: string, repositoryCoordinate: string) => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <DialogFrame
    title={step === "repository"
      ? "Select an existing repository"
      : "Choose a project"}
    description={step === "repository"
      ? "Search repository announcements that can be attached to a project."
      : "Choose the project that should include this repository."}
    size="form"
    bodyPadding="none"
  >
    <Command.Root class="community-projects__repository-command">
      <Command.Input
        placeholder={step === "repository"
          ? "Search repositories"
          : "Search projects"}
        aria-label={step === "repository"
          ? "Search repositories"
          : "Search projects"}
        aria-controls="community-project-repository-command-list"
      />
      <Command.List id="community-project-repository-command-list">
        <Command.Empty>
          {step === "repository"
            ? "No repositories are available to attach."
            : "No projects are available for this repository."}
        </Command.Empty>
        {#if step === "repository"}
          <Command.Group heading="Repositories">
            {#each repositories as repository (repository.address.coordinate)}
              <Command.Item
                value={`${repository.name} ${repository.description} ${repository.address.identifier}`}
                onSelect={() => onSelectRepository(repository)}
              >
                <GitBranchIcon aria-hidden="true" />
                <span class="community-projects__channel-command-copy">
                  <strong>{repository.name}</strong>
                  <small>
                    {repository.description || repository.address.identifier}
                  </small>
                </span>
              </Command.Item>
            {/each}
          </Command.Group>
        {:else}
          <Command.Group heading="Navigation">
            <Command.Item value="Back to repositories" onSelect={onBack}>
              <ArrowLeftIcon aria-hidden="true" />
              <span>Back to repositories</span>
            </Command.Item>
          </Command.Group>
          <Command.Group heading="Projects">
            {#each projects as project (project.address.coordinate)}
              <Command.Item
                value={`${project.name} ${project.description}`}
                onSelect={() =>
                  onSelectProject(project.address.coordinate, coordinate)}
              >
                <FolderKanbanIcon aria-hidden="true" />
                <span class="community-projects__channel-command-copy">
                  <strong>{project.name}</strong>
                  <small
                    >{project.description || project.address.identifier}</small
                  >
                </span>
              </Command.Item>
            {/each}
          </Command.Group>
        {/if}
      </Command.List>
      {#if localError}
        <p class="community-projects__command-error" role="alert">
          {localError}
        </p>
      {/if}
    </Command.Root>
  </DialogFrame>
</Dialog.Root>
