<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as InputGroup from "@lapismd/design-core/shadcn/input-group";
  import { Spinner } from "@lapismd/design-core/shadcn/spinner";
  import XIcon from "@lucide/svelte/icons/x";

  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";

  type StatusPreset = {
    emoji: string;
    label: string;
  };

  const statusPresets: readonly StatusPreset[] = [
    { emoji: "🗣️", label: "In a meeting" },
    { emoji: "🚌", label: "Commuting" },
    { emoji: "🤒", label: "Out sick" },
    { emoji: "🏖️", label: "Vacationing" },
    { emoji: "🏠", label: "Working remotely" },
  ];

  let {
    open = $bindable(false),
    value = "",
    pending = false,
    operationMessage,
    error,
    retryable = false,
    onSave,
    onRetry,
    onDismissError,
  }: {
    open?: boolean;
    value?: string;
    pending?: boolean;
    operationMessage?: string;
    error?: string;
    retryable?: boolean;
    onSave: (status: string) => void | Promise<void>;
    onRetry?: () => void | Promise<void>;
    onDismissError?: () => void;
  } = $props();

  let emoji = $state("");
  let message = $state("");
  let submitting = $state(false);
  let wasOpen = false;
  const busy = $derived(pending || submitting);

  $effect(() => {
    if (open && !wasOpen) {
      const parsed = splitStatus(value);
      emoji = parsed.emoji;
      message = parsed.message;
    }
    wasOpen = open;
  });

  function splitStatus(status: string): { emoji: string; message: string } {
    const trimmed = status.trim();
    const match = trimmed.match(
      /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u,
    );
    return match
      ? { emoji: match[1] ?? "", message: match[2] ?? "" }
      : { emoji: "", message: trimmed };
  }

  function statusValue(): string {
    return [emoji, message.trim()].filter(Boolean).join(" ");
  }

  function choosePreset(preset: StatusPreset): void {
    emoji = preset.emoji;
    message = preset.label;
  }

  async function save(event?: SubmitEvent): Promise<void> {
    event?.preventDefault();
    if (busy) return;
    submitting = true;
    try {
      await onSave(statusValue());
    } finally {
      submitting = false;
    }
  }

  async function clearStatus(): Promise<void> {
    if (busy) return;
    submitting = true;
    try {
      await onSave("");
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <DialogFrame size="form">
    {#snippet title()}Set a status{/snippet}
    {#snippet description()}Let others know what you're up to.{/snippet}

    <form
      id="communitystatusdialog-form-0"
      class="community-status-dialog__form"
      onsubmit={save}
    >
      <label class="community-status-dialog__sr-only" for="community-status">
        What's your status?
      </label>
      <InputGroup.Root class="community-status-dialog__input-group">
        <InputGroup.Addon
          class="community-status-dialog__emoji"
          align="inline-start"
        >
          <CommunityEmojiPicker
            label="Choose status emoji"
            {...emoji === "" ? {} : { selection: emoji }}
            disabled={busy}
            onSelect={(selected) => {
              emoji = selected;
            }}
          />
          {#if emoji}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="community-status-dialog__clear-emoji"
              disabled={busy}
              aria-label="Clear status emoji"
              title="Clear status emoji"
              onclick={() => (emoji = "")}
            >
              <XIcon aria-hidden="true" />
            </Button>
          {/if}
        </InputGroup.Addon>
        <InputGroup.Input
          id="community-status"
          bind:value={message}
          disabled={busy}
          maxlength={128}
          placeholder="What's your status?"
          autocomplete="off"
        />
      </InputGroup.Root>

      <div
        class="community-status-dialog__presets"
        aria-label="Suggested statuses"
      >
        {#each statusPresets as preset (preset.label)}
          <CommunityChip
            disabled={busy}
            pressed={emoji === preset.emoji && message === preset.label}
            tone={emoji === preset.emoji && message === preset.label
              ? "accent"
              : "neutral"}
            onclick={() => choosePreset(preset)}
          >
            <span aria-hidden="true">{preset.emoji}</span>
            {preset.label}
          </CommunityChip>
        {/each}
      </div>

      {#if error}
        <div class="community-status-dialog__error" role="alert">
          <p>{error}</p>
          <div class="community-status-dialog__error-actions">
            {#if retryable && onRetry}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={onRetry}
              >
                Retry
              </Button>
            {/if}
            {#if onDismissError}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss status error"
                title="Dismiss status error"
                onclick={onDismissError}
              >
                <XIcon aria-hidden="true" />
              </Button>
            {/if}
          </div>
        </div>
      {:else if operationMessage}
        <p class="community-status-dialog__operation" role="status">
          {operationMessage}
        </p>
      {/if}
    </form>

    {#snippet footer()}
      <Button
        form="communitystatusdialog-form-0"
        type="button"
        variant="ghost"
        class="community-status-dialog__clear-status"
        disabled={busy || value.trim() === ""}
        onclick={clearStatus}
      >
        Clear status
      </Button>
      <span class="community-status-dialog__footer-spacer"></span>
      <Button
        form="communitystatusdialog-form-0"
        type="button"
        variant="ghost"
        disabled={busy}
        onclick={() => (open = false)}
      >
        Cancel
      </Button>
      <Button
        form="communitystatusdialog-form-0"
        type="submit"
        disabled={busy || statusValue() === value.trim()}
      >
        {#if busy}<Spinner aria-hidden="true" />{/if}
        Save
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>

<style>
  .community-status-dialog__form {
    display: grid;
    gap: 1.25rem;
  }

  .community-status-dialog__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    border: 0;
    margin: -1px;
    clip: rect(0, 0, 0, 0);
    overflow: hidden;
    white-space: nowrap;
  }

  :global(.community-status-dialog__input-group[data-ui-part="input-group"]) {
    height: 2.75rem;
    border-radius: 0.75rem;
  }

  :global(.community-status-dialog__emoji[data-ui-part="input-group-addon"]) {
    position: relative;
    gap: 0;
    padding: 0.2rem 0.15rem 0.2rem 0.25rem;
  }

  :global(.community-status-dialog__emoji [data-ui-component="button"]) {
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 0.6rem;
    font-size: var(--community-text-section);
  }

  :global(.community-status-dialog__clear-emoji[data-ui-component="button"]) {
    position: absolute;
    inset-block-start: -0.35rem;
    inset-inline-end: -0.35rem;
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--background);
  }

  :global(.community-status-dialog__clear-emoji svg) {
    width: 0.625rem;
    height: 0.625rem;
  }

  .community-status-dialog__presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .community-status-dialog__error {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--destructive) 32%, transparent);
    border-radius: 0.75rem;
    padding: 0.55rem 0.65rem 0.55rem 0.8rem;
    color: var(--destructive);
    background: color-mix(in srgb, var(--destructive) 7%, transparent);
  }

  .community-status-dialog__error p,
  .community-status-dialog__operation {
    min-width: 0;
    flex: 1;
    margin: 0;
    font-size: var(--community-text-secondary);
  }

  .community-status-dialog__operation {
    color: var(--muted-foreground);
  }

  .community-status-dialog__error-actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.25rem;
  }

  :global(.community-status-dialog__clear-status[data-ui-component="button"]) {
    color: var(--muted-foreground);
  }

  .community-status-dialog__footer-spacer {
    flex: 1;
  }

  @media (max-width: 40rem) {
  }
</style>
