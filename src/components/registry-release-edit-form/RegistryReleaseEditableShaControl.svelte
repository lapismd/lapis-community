<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";

  import "./RegistryReleaseEditableShaControl.css";

  let {
    value,
    label,
    readonly = false,
    update,
    blur = () => {},
  }: {
    value: string;
    label: string;
    readonly?: boolean;
    update: (value: string) => void | Promise<void>;
    blur?: () => void;
  } = $props();

  let editing = $state(false);
  let copied = $state(false);
  let failed = $state(false);
  let input = $state<HTMLInputElement | null>(null);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  const displayValue = $derived(value || "No SHA-256");

  onDestroy(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });

  function shortenSha(sha: string): string {
    if (sha.length <= 17) return sha;
    return `${sha.slice(0, 10)}…${sha.slice(-6)}`;
  }

  async function startEditing(): Promise<void> {
    if (readonly) return;
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }

  function finishEditing(): void {
    editing = false;
    blur();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      finishEditing();
    }
  }

  async function copySha(): Promise<void> {
    copied = false;
    failed = false;
    try {
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await clipboard.writeText(value);
      copied = true;
    } catch {
      failed = true;
    }
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = false;
      failed = false;
    }, 1_500);
  }
</script>

{#if editing}
  <input
    bind:this={input}
    class="registry-release-editable-sha__input"
    value={value}
    aria-label={label}
    autocomplete="off"
    spellcheck="false"
    oninput={(event) => update(event.currentTarget.value)}
    onkeydown={handleKeydown}
    onblur={finishEditing}
  />
{:else}
  <div class="registry-release-editable-sha__split">
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              type="button"
              class="registry-release-editable-sha__preview"
              aria-label={readonly
                ? `${label}: ${displayValue}`
                : `Edit ${label}: ${displayValue}`}
              disabled={readonly}
              onclick={() => void startEditing()}
            >
              <code>{shortenSha(displayValue)}</code>
            </button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="top" sideOffset={6}
          >{displayValue}</Tooltip.Content
        >
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              type="button"
              class="registry-release-editable-sha__copy"
              aria-label={`Copy ${label}: ${displayValue}`}
              data-copied={copied ? "" : undefined}
              data-copy-failed={failed ? "" : undefined}
              onclick={() => void copySha()}
            >
              {#if copied}
                <CheckIcon data-ui-part="copy-icon" aria-hidden="true" />
              {:else if failed}
                <TriangleAlertIcon data-ui-part="copy-icon" aria-hidden="true" />
              {:else}
                <CopyIcon data-ui-part="copy-icon" aria-hidden="true" />
              {/if}
            </button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="top" sideOffset={6}>Copy SHA-256</Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  </div>
{/if}
