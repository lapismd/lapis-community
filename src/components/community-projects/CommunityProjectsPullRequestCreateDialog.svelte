<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    ProjectForgeRef,
    ProjectForgeRepository,
  } from "../../projects/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { CommunityProjectsCreatePullRequest } from "./model.js";

  let {
    open = $bindable(false),
    draft = $bindable({
      repository: "",
      title: "",
      content: "",
      branchName: "",
      targetBranch: "",
    }),
    repositories = [],
    branches = [],
    compareBranches = [],
    refsLoading = false,
    refsError = "",
    busy = false,
    operation = "",
    localError = "",
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    onOpenChange,
    onSelectRepository,
    onSubmit,
  }: {
    open?: boolean | undefined;
    draft?: CommunityProjectsCreatePullRequest | undefined;
    repositories?: readonly ProjectForgeRepository[] | undefined;
    branches?: readonly ProjectForgeRef[] | undefined;
    compareBranches?: readonly ProjectForgeRef[] | undefined;
    refsLoading?: boolean | undefined;
    refsError?: string | undefined;
    busy?: boolean | undefined;
    operation?: string | undefined;
    localError?: string | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    onOpenChange: () => void;
    onSelectRepository: (value: string) => void;
    onSubmit: (event: SubmitEvent) => void;
  } = $props();
</script>

<Dialog.Root bind:open onOpenChange={onOpenChange}>
  <DialogFrame size="wide">
    {#snippet title()}Open a review{/snippet}
    {#snippet description()}
      Compare an existing branch and publish a NIP-34 pull request.
    {/snippet}

    <form
      id="communityprojects-form-5"
      class="community-projects__project-form"
      onsubmit={onSubmit}
    >
      <Field.Group class="community-projects__project-fields">
        <div class="community-projects__review-source-options">
          <Field.Field>
            <Field.Label for="pr-repository">Repository</Field.Label>
            <Select.Root
              type="single"
              value={draft.repository}
              onValueChange={(value) => {
                if (value) onSelectRepository(value);
              }}
            >
              <Select.Trigger id="pr-repository" role="combobox">
                {repositories.find(
                  (repository) =>
                    repository.address.coordinate === draft.repository,
                )?.name ?? "Select repository"}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  {#each repositories as repository (repository.address.coordinate)}
                    <Select.Item
                      value={repository.address.coordinate}
                      label={repository.name}>{repository.name}</Select.Item
                    >
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Field.Field>

          <div class="community-projects__form-columns">
            <Field.Field>
              <Field.Label for="pr-target">Base</Field.Label>
              <Select.Root
                type="single"
                value={draft.targetBranch}
                onValueChange={(value) => {
                  if (!value) return;
                  draft.targetBranch = value;
                  if (draft.branchName === value) draft.branchName = "";
                }}
              >
                <Select.Trigger
                  id="pr-target"
                  aria-label="Base branch"
                  disabled={refsLoading || branches.length === 0}
                >
                  {refsLoading
                    ? "Loading branches…"
                    : draft.targetBranch || "Select base branch"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each branches as branch (branch.name)}
                      <Select.Item value={branch.name} label={branch.name}
                        >{branch.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Field.Field>
            <Field.Field>
              <Field.Label for="pr-branch">Compare</Field.Label>
              <Select.Root
                type="single"
                value={draft.branchName}
                onValueChange={(value) => {
                  if (value) draft.branchName = value;
                }}
              >
                <Select.Trigger
                  id="pr-branch"
                  aria-label="Compare branch"
                  disabled={refsLoading || compareBranches.length === 0}
                >
                  {refsLoading
                    ? "Loading branches…"
                    : draft.branchName || "Select compare branch"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each compareBranches as branch (branch.name)}
                      <Select.Item value={branch.name} label={branch.name}
                        >{branch.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Field.Field>
          </div>
          {#if refsError}
            <Field.Error>{refsError}</Field.Error>
          {/if}
        </div>

        <Field.Field>
          <Field.Label for="pr-title">Title</Field.Label>
          <Input
            id="pr-title"
            bind:value={draft.title}
            placeholder="Describe the change"
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="pr-description">
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={draft.content}
            placeholder="Add context for reviewers"
            ariaLabel="Review description"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            mode="form"
          />
        </Field.Field>
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
    </form>

    {#snippet footer()}
      <Button
        form="communityprojects-form-5"
        type="submit"
        disabled={busy ||
          !draft.repository ||
          !draft.title.trim() ||
          !draft.targetBranch ||
          !draft.branchName ||
          draft.targetBranch === draft.branchName ||
          refsLoading ||
          !!refsError}
      >
        {busy ? operation : "Create review"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>
