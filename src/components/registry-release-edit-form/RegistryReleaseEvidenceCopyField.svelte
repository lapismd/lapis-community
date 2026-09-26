<script lang="ts">
  import { onDestroy } from "svelte";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import "./RegistryReleaseEvidenceCopyField.css";

  type Props = RegisteredFormRendererProps<
    "registry-copy-id",
    RegistryReleaseEditDraft
  >;

  let { value, field }: Props = $props();

  let copied = $state(false);
  let failed = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  const label = $derived(field.copyLabel ?? field.label ?? "value");

  onDestroy(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });

  function shortenId(id: string): string {
    if (id.length <= 17) return id;
    return `${id.slice(0, 10)}…${id.slice(-6)}`;
  }

  async function copyValue(): Promise<void> {
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

<Tooltip.Provider delayDuration={0}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          class="registry-release-evidence-copy"
          aria-label="Copy full {label}: {value}"
          data-copied={copied ? "" : undefined}
          data-copy-failed={failed ? "" : undefined}
          onclick={() => void copyValue()}
        >
          <code>{shortenId(value)}</code>
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
    <Tooltip.Content side="top" sideOffset={6}>{value}</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
