<script lang="ts">
  import * as Chat from "@lapismd/design-core/ai/chat";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  let { call }: { call: { data?: unknown; name?: string } } = $props();
  const detail = $derived(
    call.data as
      | Extract<CommunityAgentTranscriptEntry, { type: "tool" }>
      | undefined,
  );
</script>

<Chat.ToolCallDetail
  {...detail?.input === undefined ? {} : { input: detail.input }}
  {...detail?.output === undefined ? {} : { output: detail.output }}
  {...detail?.error === undefined ? {} : { error: detail.error }}
  {...(detail?.name ?? call.name)
    ? { toolName: detail?.name ?? call.name }
    : {}}
/>
