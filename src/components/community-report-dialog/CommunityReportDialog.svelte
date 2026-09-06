<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
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
  <Dialog.Content class="community-report-dialog">
    <form class="community-report-dialog__form" onsubmit={submit}>
      <Dialog.Header>
        <Dialog.Title>
          <FlagIcon data-icon="inline-start" aria-hidden="true" />
          Report message
        </Dialog.Title>
        <Dialog.Description>
          Reports are sent privately to this community's curators for review.
          The message author is not told who reported them.
        </Dialog.Description>
      </Dialog.Header>

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
          <Field.Label for="community-report-context">
            Additional context <span>(optional)</span>
          </Field.Label>
          <Textarea
            id="community-report-context"
            bind:value={context}
            rows={3}
            placeholder="Add anything that helps curators…"
          />
          {#if error}<Field.Error>{error}</Field.Error>{/if}
        </Field.Field>
      </Field.Group>

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onclick={() => (open = false)}>Cancel</Button
        >
        <Button type="submit" disabled={category === "" || pending}>
          {pending ? "Sending…" : "Submit report"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-report-dialog) {
    width: min(calc(100vw - 2rem), 30rem);
  }

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
