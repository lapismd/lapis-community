<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import { CodeBlock } from "@lapismd/design-core/shadcn/code-block";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  import CommunityAgentTranscriptTimedRow from "./CommunityAgentTranscriptTimedRow.svelte";

  let {
    item,
  }: {
    item: Extract<CommunityAgentTranscriptEntry, { type: "permission" }>;
  } = $props();

  let open = $state(false);
  const label = $derived(
    `Permission ${item.decision ?? "resolved"} for ${item.tool}`,
  );
  const command = $derived(stripCommandFence(item.tool));
  const commandCode = $derived(
    command.startsWith("$") ? command : `$ ${command}`,
  );

  function stripCommandFence(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith("```") && trimmed.endsWith("```"))
      return trimmed
        .replace(/^```(?:\w+)?\s*/u, "")
        .replace(/```$/u, "")
        .trim();
    if (trimmed.startsWith("`") && trimmed.endsWith("`"))
      return trimmed.slice(1, -1);
    return value;
  }
</script>

<CommunityAgentTranscriptTimedRow
  createdAt={item.createdAt}
  label="Permission resolved"
  timeOffset="0"
>
  <button
    type="button"
    class="agent-transcript-permission"
    title={label}
    aria-expanded={open}
    aria-label={`${open ? "Hide" : "Show"} permission command for ${item.tool}`}
    data-ui-part="agent-transcript-permission"
    onclick={() => {
      open = !open;
    }}
  >
    <span class="agent-transcript-permission__icon" aria-hidden="true">
      <ShieldCheckIcon />
    </span>
    <span class="agent-transcript-permission__label">{label}</span>
    <span
      class="agent-transcript-permission__chevron"
      data-direction={open ? "down" : "right"}
      style={`rotate: ${open ? "90deg" : "0deg"}`}
      aria-hidden="true"
    >
      <ChevronRightIcon />
    </span>
  </button>
  {#if open}
    <div class="agent-transcript-permission__detail">
      <CodeBlock
        code={commandCode}
        language="bash"
        title="Permission command"
        size="sm"
        width="full"
        isWrapped
        maxHeight="16rem"
      />
    </div>
  {/if}
</CommunityAgentTranscriptTimedRow>

<style>
  .agent-transcript-permission {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 1.5rem;
    align-items: center;
    gap: 0.375rem;
    overflow: hidden;
    border: 0;
    border-radius: 0.375rem;
    background: transparent;
    margin: 0;
    padding: 0.125rem 0;
    color: var(--muted-foreground);
    font: inherit;
    font-size: var(--community-text-secondary);
    line-height: 1rem;
    text-align: left;
    cursor: pointer;
  }

  .agent-transcript-permission:hover {
    background: var(--accent);
  }

  .agent-transcript-permission__icon {
    display: inline-flex;
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    color: var(--ui-ai-chat-success, var(--chart-2));
  }

  .agent-transcript-permission__icon :global(svg),
  .agent-transcript-permission__chevron :global(svg) {
    width: 0.875rem;
    height: 0.875rem;
  }

  .agent-transcript-permission__label {
    min-width: 0;
    overflow: hidden;
    flex: 1 1 auto;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-transcript-permission__chevron {
    display: inline-flex;
    flex: 0 0 auto;
    transition: rotate 160ms ease;
  }

  .agent-transcript-permission__detail {
    min-width: 0;
    padding: 0.25rem 0 0.5rem 1.375rem;
  }
</style>
