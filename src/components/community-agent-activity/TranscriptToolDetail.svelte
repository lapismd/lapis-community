<script lang="ts">
  import * as Chat from "@lapismd/design-core/ai/chat";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  import TranscriptToolRichDetail from "./TranscriptToolRichDetail.svelte";
  import { richTranscriptToolDetail } from "./transcript-tool-rich.js";
  let {
    call,
    raw = false,
  }: { call: { data?: unknown; name?: string }; raw?: boolean } = $props();
  const detail = $derived(
    call.data as
      | Extract<CommunityAgentTranscriptEntry, { type: "tool" }>
      | undefined,
  );
  const rich = $derived(detail ? richTranscriptToolDetail(detail) : undefined);
</script>

<div class="transcript-tool-detail" data-mode={raw || !rich ? "raw" : "rich"}>
  {#if detail?.redacted || detail?.truncated}
    <p class="transcript-tool-detail__notice">
      {[
        detail.redacted ? "Sensitive fields were redacted." : "",
        detail.truncated ? "Output was truncated." : "",
      ]
        .filter(Boolean)
        .join(" ")}
    </p>
  {/if}
  {#if rich && !raw}
    <TranscriptToolRichDetail detail={rich} />
  {:else}
    <Chat.ToolCallDetail
      {...detail?.input === undefined ? {} : { input: detail.input }}
      {...detail?.output === undefined ? {} : { output: detail.output }}
      {...detail?.error === undefined ? {} : { error: detail.error }}
      {...(detail?.name ?? call.name)
        ? { toolName: detail?.name ?? call.name }
        : {}}
    />
  {/if}
</div>

<style>
  .transcript-tool-detail {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
  }

  .transcript-tool-detail__notice {
    margin: 0;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
</style>
