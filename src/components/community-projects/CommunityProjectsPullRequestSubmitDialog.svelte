<script lang="ts">
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type { PullRequestReviewKind } from "../../projects/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    submissionOpen = $bindable(false),
    closeOpen = $bindable(false),
    decision = $bindable("comment" as PullRequestReviewKind),
    body = $bindable(""),
    submissionError = $bindable(""),
    closeError = "",
    busy = false,
    canCollaborate = false,
    operation = "",
    pullRequestTitle = "the pull request",
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    onSubmit,
    onConfirmClose,
  }: {
    submissionOpen?: boolean | undefined;
    closeOpen?: boolean | undefined;
    decision?: PullRequestReviewKind | undefined;
    body?: string | undefined;
    submissionError?: string | undefined;
    closeError?: string | undefined;
    busy?: boolean | undefined;
    canCollaborate?: boolean | undefined;
    operation?: string | undefined;
    pullRequestTitle?: string | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    onSubmit: () => void;
    onConfirmClose: () => void | boolean | Promise<void | boolean>;
  } = $props();
</script>

<Dialog.Root bind:open={submissionOpen}>
  <DialogFrame size="wide">
    {#snippet title()}Submit review{/snippet}
    {#snippet description()}
      Publish one signed review decision to the relay. Connected providers can
      mirror it as a native review.
    {/snippet}

    <div class="community-projects__review-submission-form">
      <Field.Group class="community-projects__review-submission-fields">
        <Field.Field data-invalid={submissionError ? "" : undefined}>
          <Field.Label>
            Review
            {#if decision === "approved"}
              <span>Optional</span>
            {/if}
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__review-submission-composer"
            bind:value={body}
            ariaLabel="Review"
            placeholder={decision === "approved"
              ? "Leave an optional approval note…"
              : decision === "changes-requested"
                ? "Explain what needs to change…"
                : "Leave a review comment…"}
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            {busy}
            disabled={!canCollaborate}
            disabledReason="Sign in to submit a review"
            mode="form"
          />
          <Field.Description>
            {decision === "approved"
              ? "An approval can be submitted without a message."
              : "A message is required for this review decision."}
          </Field.Description>
          {#if submissionError}
            <Field.Error>{submissionError}</Field.Error>
          {/if}
        </Field.Field>
        <fieldset class="community-projects__review-decision">
          <legend>Review decision</legend>
          <label class="community-projects__review-decision-option">
            <input
              type="radio"
              name="project-review-decision"
              value="comment"
              aria-label="Comment"
              bind:group={decision}
              onchange={() => (submissionError = "")}
            />
            <span>
              <strong>Comment</strong>
              <small>Submit general feedback without explicit approval.</small>
            </span>
          </label>
          <label class="community-projects__review-decision-option">
            <input
              type="radio"
              name="project-review-decision"
              value="approved"
              aria-label="Approve"
              bind:group={decision}
              onchange={() => (submissionError = "")}
            />
            <span>
              <strong>Approve</strong>
              <small>Submit feedback and approve these changes.</small>
            </span>
          </label>
          <label class="community-projects__review-decision-option">
            <input
              type="radio"
              name="project-review-decision"
              value="changes-requested"
              aria-label="Request changes"
              bind:group={decision}
              onchange={() => (submissionError = "")}
            />
            <span>
              <strong>Request changes</strong>
              <small>
                Submit feedback that must be addressed before merging.
              </small>
            </span>
          </label>
        </fieldset>
      </Field.Group>
    </div>

    {#snippet footer()}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onclick={() => (submissionOpen = false)}>Cancel</Button
      >
      <Button
        type="button"
        disabled={busy || (decision !== "approved" && body.trim() === "")}
        onclick={onSubmit}
      >
        {busy
          ? operation
          : decision === "approved"
            ? "Submit approval"
            : decision === "changes-requested"
              ? "Request changes"
              : "Submit comment"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>

<ConfirmDialog
  bind:open={closeOpen}
  pending={busy}
  destructive
  onConfirm={onConfirmClose}
>
  {#snippet title()}Close pull request?{/snippet}
  {#snippet description()}
    This closes {pullRequestTitle} without merging it. It can be reopened later.
  {/snippet}
  {#snippet confirmLabel()}
    {busy ? "Closing…" : "Close pull request"}
  {/snippet}

  {#if closeError}
    <p class="community-projects__review-merge-error" role="alert">
      {closeError}
    </p>
  {/if}
</ConfirmDialog>
