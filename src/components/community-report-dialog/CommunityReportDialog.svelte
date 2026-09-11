<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import FlagIcon from "@lucide/svelte/icons/flag";

  import type {
    CommunityMessageReport,
    CommunityMessageReportCategory,
  } from "../../community/index.js";

  const reasons: readonly {
    value: CommunityMessageReportCategory;
    label: string;
  }[] = [
    { value: "spam", label: "Spam" },
    { value: "profanity", label: "Profanity or hate speech" },
    { value: "nudity", label: "Nudity or sexual content" },
    { value: "impersonation", label: "Impersonation" },
    { value: "malware", label: "Malware or scam" },
    { value: "illegal", label: "Illegal content" },
    { value: "other", label: "Other" },
  ];

  let {
    open = $bindable(false),
    onSubmit,
  }: {
    open?: boolean;
    onSubmit: (report: CommunityMessageReport) => void | Promise<void>;
  } = $props();

  let category = $state<CommunityMessageReportCategory | "">("");
  let context = $state("");
  let pending = $state(false);
  let error = $state("");

  function selectReason(value: string | undefined): void {
    category = reasons.some((reason) => reason.value === value)
      ? (value as CommunityMessageReportCategory)
      : "";
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (category === "" || pending) return;
    pending = true;
    error = "";
    try {
      await onSubmit({
        category,
        ...(context.trim() === "" ? {} : { context: context.trim() }),
      });
      open = false;
      category = "";
      context = "";
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "The report could not be sent";
    } finally {
      pending = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <DialogFrame size="form">
    {#snippet title()}
      <FlagIcon data-icon="inline-start" aria-hidden="true" />
      Report message
    {/snippet}
    {#snippet description()}
      Reports are sent privately to this community's curators for review. The
      message author is not told who reported them.
    {/snippet}

    <form
      id="communityreportdialog-form-0"
      class="community-report-dialog__form"
      onsubmit={submit}
    >
      <Field.Group>
        <Field.Set>
          <Field.Legend>Reason</Field.Legend>
          <ToggleGroup.Root
            class="community-report-dialog__reasons"
            type="single"
            value={category}
            onValueChange={selectReason}
            orientation="vertical"
            spacing={2}
            aria-label="Report reason"
          >
            {#each reasons as reason (reason.value)}
              <ToggleGroup.Item
                value={reason.value}
                variant="outline"
                aria-label={reason.label}
              >
                {reason.label}
              </ToggleGroup.Item>
            {/each}
          </ToggleGroup.Root>
        </Field.Set>
        <Field.Field data-invalid={error ? "" : undefined}>
          <Field.Label>
            Additional context <span>(optional)</span>
          </Field.Label>
          <CommunityChatComposer
            mode="form"
            ariaLabel="Additional context"
            bind:value={context}
            placeholder="Add anything that helps curators…"
          />
          {#if error}<Field.Error>{error}</Field.Error>{/if}
        </Field.Field>
      </Field.Group>
    </form>

    {#snippet footer()}
      <Button
        form="communityreportdialog-form-0"
        type="button"
        variant="outline"
        disabled={pending}
        onclick={() => (open = false)}>Cancel</Button
      >
      <Button
        form="communityreportdialog-form-0"
        type="submit"
        disabled={category === "" || pending}
      >
        {pending ? "Sending…" : "Submit report"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>

<style>
  .community-report-dialog__form {
    display: grid;
    gap: 1.25rem;
  }

  .community-report-dialog__form :global([data-ui-part="dialog-title"]) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  :global(.community-report-dialog__reasons) {
    display: grid;
    width: 100%;
    gap: 0.45rem;
  }

  :global(
      .community-report-dialog__reasons [data-ui-part="toggle-group-item"]
    ) {
    width: 100%;
    justify-content: flex-start;
  }

  .community-report-dialog__form :global([data-ui-part="field-label"] span) {
    color: var(--muted-foreground);
    font-weight: 400;
  }
</style>
