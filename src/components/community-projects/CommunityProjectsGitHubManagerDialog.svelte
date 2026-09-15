<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import GitForkIcon from "@lucide/svelte/icons/git-fork";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";

  import type { ProjectForgeGitHubConnection } from "../../projects/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import CommunityProjectsGitHubConnectionForm from "./CommunityProjectsGitHubConnectionForm.svelte";

  let {
    open = $bindable(false),
    formOpen = $bindable(false),
    draft = $bindable({
      appId: "",
      installationId: "",
      credentialRef: "",
      webhookSecretRef: "",
      bridgeCredentialRef: "",
      bridgePubkey: "",
    }),
    connections = [],
    editing,
    loading = false,
    error = "",
    operation = "",
    onSubmit,
    onRefresh,
    onRevalidate,
    onOpenForm,
    onBack,
  }: {
    open?: boolean | undefined;
    formOpen?: boolean | undefined;
    draft?: {
      appId: string;
      installationId: string;
      credentialRef: string;
      webhookSecretRef: string;
      bridgeCredentialRef: string;
      bridgePubkey: string;
    } | undefined;
    connections?: readonly ProjectForgeGitHubConnection[] | undefined;
    editing?: ProjectForgeGitHubConnection | undefined;
    loading?: boolean | undefined;
    error?: string | undefined;
    operation?: string | undefined;
    onSubmit: (event: SubmitEvent) => void;
    onRefresh: () => void;
    onRevalidate: (connection: ProjectForgeGitHubConnection) => void;
    onOpenForm: (connection?: ProjectForgeGitHubConnection) => void;
    onBack: () => void;
  } = $props();
</script>

<Dialog.Root bind:open>
  <DialogFrame size="wide">
    {#snippet title()}GitHub App connections{/snippet}
    {#snippet description()}
      Relay administrators can add installations, check their health, or replace
      the complete mounted-credential configuration.
    {/snippet}

    {#if error}
      <Alert.Root variant="destructive" class="community-projects__alert">
        <Alert.Title>GitHub App action failed</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
      </Alert.Root>
    {/if}
    {#if operation}
      <p class="community-projects__github-manager-updated" role="status">
        {operation}
      </p>
    {/if}

    {#if loading}
      <div class="community-projects__github-manager-loading" role="status">
        <Skeleton />
        <Skeleton />
      </div>
    {:else if formOpen}
      <CommunityProjectsGitHubConnectionForm
        bind:draft
        replacing={editing !== undefined}
        {onSubmit}
      />
    {:else}
      <div class="community-projects__github-manager-list">
        {#each connections as connection (connection.id)}
          <article class="community-projects__github-manager-row">
            <div class="community-projects__github-manager-copy">
              <GitForkIcon aria-hidden="true" />
              <div>
                <strong>
                  {connection.account_login
                    ? `@${connection.account_login}`
                    : `Installation ${connection.installation_id}`}
                </strong>
                <span>
                  {connection.host} · installation {connection.installation_id}
                </span>
              </div>
              <CommunityChip
                size="compact"
                tone={connection.status === "active" ? "success" : "danger"}
              >
                {connection.status}
              </CommunityChip>
            </div>
            {#if connection.detail}
              <p class="community-projects__github-manager-detail">
                {connection.detail}
              </p>
            {/if}
            {#if connection.updated_at}
              <p class="community-projects__github-manager-updated">
                Checked <CommunityRelativeTime
                  timestamp={Math.floor(
                    new Date(connection.updated_at).getTime() / 1_000,
                  )}
                />
              </p>
            {/if}
            <div class="community-projects__github-manager-actions">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={operation !== ""}
                onclick={() => onRevalidate(connection)}
              >
                <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                Revalidate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={operation !== ""}
                onclick={() => onOpenForm(connection)}
              >
                Replace configuration
              </Button>
            </div>
          </article>
        {:else}
          <Empty.Root class="community-projects__empty">
            <Empty.Header>
              <Empty.Media variant="icon"
                ><GitForkIcon aria-hidden="true" /></Empty.Media
              >
              <Empty.Title>No GitHub App connections</Empty.Title>
              <Empty.Description>
                Add an installation after its credentials are mounted on the
                relay.
              </Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/each}
      </div>
    {/if}

    {#snippet footer()}
      {#if !loading}
        {#if formOpen}
          <Button
            form="communityprojects-form-3"
            type="button"
            variant="ghost"
            disabled={operation !== ""}
            onclick={onBack}
          >
            Back
          </Button>
          <Button
            form="communityprojects-form-3"
            type="submit"
            disabled={operation !== ""}
          >
            {operation || (editing ? "Replace configuration" : "Add connection")}
          </Button>
        {:else}
          <Button
            type="button"
            variant="outline"
            disabled={operation !== ""}
            onclick={onRefresh}
          >
            <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
            Refresh
          </Button>
          <Button
            type="button"
            disabled={operation !== ""}
            onclick={() => onOpenForm()}
          >
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Add connection
          </Button>
        {/if}
      {/if}
    {/snippet}
  </DialogFrame>
</Dialog.Root>
