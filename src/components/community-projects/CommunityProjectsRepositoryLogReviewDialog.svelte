<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";

  import type { LogReviewSubmitInput } from "../../projects/log-review.js";
  import type { ProjectForgeRef } from "../../projects/model.js";
  import { workspaceBranchForCommit } from "../../projects/workspace-branch.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityRepositoryBranchCommand from "../community-repository-branch-command/CommunityRepositoryBranchCommand.svelte";

  let {
    open = $bindable(false),
    reviewTitle = $bindable(""),
    reviewBody = $bindable(""),
    targetBranch = $bindable(""),
    commit,
    branches = [],
    busy = false,
    localError = "",
    onSubmit,
  }: {
    open?: boolean | undefined;
    reviewTitle?: string | undefined;
    reviewBody?: string | undefined;
    targetBranch?: string | undefined;
    commit: string;
    branches?: readonly ProjectForgeRef[] | undefined;
    busy?: boolean | undefined;
    localError?: string | undefined;
    onSubmit: (input: LogReviewSubmitInput) => Promise<void>;
  } = $props();

  const refs = $derived(branches ?? []);

  async function submitReview(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const branchName = workspaceBranchForCommit(commit, refs, targetBranch);
    await onSubmit({
      title: reviewTitle.trim(),
      content: reviewBody,
      commit,
      targetBranch,
      ...(branchName ? { branchName } : {}),
    });
  }
</script>

<Dialog.Root bind:open>
  <DialogFrame size="wide">
    {#snippet title()}Create review{/snippet}
    {#snippet description()}
      Publish a review for {commit}
    {/snippet}
    <form class="community-projects__project-form" onsubmit={submitReview}>
      <Field.Group class="community-projects__project-fields">
        <Field.Field>
          <Field.Label>Base</Field.Label>
          <CommunityRepositoryBranchCommand
            branch={targetBranch}
            branches={refs}
            includeSync={false}
            label="Base branch"
            heading="Select base branch"
            onSelectBranch={(value) => {
              if (value) targetBranch = value;
            }}
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="log-review-title">Title</Field.Label>
          <Input id="log-review-title" bind:value={reviewTitle} required />
        </Field.Field>
        <Field.Field>
          <Field.Label>
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={reviewBody}
            placeholder="Add context for reviewers"
            ariaLabel="Review description"
            mode="form"
          />
        </Field.Field>
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
      <Button
        type="submit"
        disabled={busy ||
          !reviewTitle.trim() ||
          (refs.length > 0 && !targetBranch)}
      >
        {busy ? "Creating review…" : "Create review"}
      </Button>
    </form>
  </DialogFrame>
</Dialog.Root>
