<script lang="ts">
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  import type { TranscriptCommentSource } from "../community-agent-conversation/transcript-comment-sources.js";
  import CommunityTranscriptComments from "../community-transcript-comments/CommunityTranscriptComments.svelte";
  import CommunityAgentTranscriptTimedRow from "./CommunityAgentTranscriptTimedRow.svelte";

  let {
    item,
    source,
    focused = false,
    isStreaming,
  }: {
    item: Extract<CommunityAgentTranscriptEntry, { type: "thinking" }>;
    source?: TranscriptCommentSource | undefined;
    focused?: boolean;
    isStreaming: (id: string) => boolean;
  } = $props();

  const running = $derived(item.state === "streaming" && isStreaming(item.id));
</script>

<CommunityAgentTranscriptTimedRow
  createdAt={item.createdAt}
  label="Thinking recorded"
  timeOffset="0.75rem"
>
  <CommunityTranscriptComments {source} label="Thinking" text={item.text}>
    <Reasoning
      streaming={running}
      preview={item.text}
      expanded={focused || running}
    >
      {item.text}
    </Reasoning>
  </CommunityTranscriptComments>
</CommunityAgentTranscriptTimedRow>
