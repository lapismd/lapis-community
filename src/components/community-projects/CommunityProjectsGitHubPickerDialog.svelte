<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import GitForkIcon from "@lucide/svelte/icons/git-fork";

  import type {
    ProjectForgeGitHubConnection,
    ProjectForgeGitHubRepository,
    ProjectForgeRepository,
  } from "../../projects/index.js";

  let {
    open = $bindable(false),
    step = $bindable("connection"),
    connection = $bindable(),
    selectedRepository,
    connections = [],
    repositories = [],
    loading = false,
    error = "",
    canManage = false,
    onSelectConnection,
    onBack,
    onSelectRepository,
    onManage,
  }: {
    open?: boolean | undefined;
    step?: "connection" | "repository" | undefined;
    connection?: ProjectForgeGitHubConnection | undefined;
    selectedRepository?: ProjectForgeRepository | undefined;
    connections?: readonly ProjectForgeGitHubConnection[] | undefined;
    repositories?: readonly ProjectForgeGitHubRepository[] | undefined;
    loading?: boolean | undefined;
    error?: string | undefined;
    canManage?: boolean | undefined;
    onSelectConnection: (connection: ProjectForgeGitHubConnection) => void;
    onBack: () => void;
    onSelectRepository: (repository: ProjectForgeGitHubRepository) => void;
    onManage: () => void;
  } = $props();
</script>

{#snippet footer()}
  {#if step === "connection" && canManage}
    <div class="community-projects__github-command-footer">
      <Button type="button" variant="outline" onclick={onManage}>
        <GitForkIcon data-icon="inline-start" aria-hidden="true" />
        Manage GitHub App connections
      </Button>
    </div>
  {/if}
{/snippet}

<Dialog.Root bind:open>
  <DialogFrame
    title={step === "connection"
      ? "Connect to a GitHub App"
      : `Choose a repository from @${connection?.account_login ?? "GitHub"}`}
    description={step === "connection"
      ? `Choose the GitHub App installation that should manage ${selectedRepository?.name ?? "this repository"}.`
      : "Only the GitHub repository matching this signed repository announcement can be connected."}
    size="form"
    bodyPadding="none"
    {...step === "connection" && canManage ? { footer } : {}}
  >
    <Command.Root class="community-projects__repository-command">
      <Command.Input
        placeholder={step === "connection"
          ? "Search GitHub App connections"
          : "Search GitHub repositories"}
        aria-label={step === "connection"
          ? "Search GitHub App connections"
          : "Search GitHub repositories"}
        aria-controls="community-project-github-command-list"
      />
      <Command.List id="community-project-github-command-list">
        {#if loading}
          <p class="community-projects__command-status" role="status">
            {step === "connection"
              ? "Loading GitHub App connections…"
              : "Loading GitHub repositories…"}
          </p>
        {:else if step === "connection"}
          <Command.Empty>No active GitHub App connections found.</Command.Empty>
          <Command.Group heading="GitHub App connections">
            {#each connections as item (item.id)}
              <Command.Item
                value={`${item.account_login} ${item.host} ${item.installation_id}`}
                onSelect={() => onSelectConnection(item)}
              >
                <GitForkIcon aria-hidden="true" />
                <span class="community-projects__channel-command-copy">
                  <strong>@{item.account_login}</strong>
                  <small
                    >{item.host} · installation {item.installation_id}</small
                  >
                </span>
              </Command.Item>
            {/each}
          </Command.Group>
        {:else}
          <Command.Group heading="Navigation">
            <Command.Item
              value="Back to GitHub App connections"
              onSelect={onBack}
            >
              <ArrowLeftIcon aria-hidden="true" />
              <span>Back to GitHub App connections</span>
            </Command.Item>
          </Command.Group>
          {#if repositories.length > 0}
            <Command.Group heading="Matching repository">
              {#each repositories as repository (repository.id)}
                <Command.Item
                  value={`${repository.full_name} ${repository.default_branch}`}
                  disabled={repository.archived || repository.disabled}
                  onSelect={() => onSelectRepository(repository)}
                >
                  <GitForkIcon aria-hidden="true" />
                  <span class="community-projects__channel-command-copy">
                    <strong>{repository.full_name}</strong>
                    <small
                      >{repository.private ? "Private" : "Public"} · {repository.default_branch}</small
                    >
                  </span>
                </Command.Item>
              {/each}
            </Command.Group>
          {:else if !error}
            <p class="community-projects__command-status">
              No repository in this installation matches both the signed clone
              and web URLs.
            </p>
          {/if}
        {/if}
      </Command.List>
      {#if error}
        <p class="community-projects__command-error" role="alert">{error}</p>
      {/if}
    </Command.Root>
  </DialogFrame>
</Dialog.Root>
