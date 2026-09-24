<script lang="ts">
  import * as Chat from "@lapismd/design-core/ai/chat";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  import type { TranscriptCommentSource } from "../community-agent-conversation/transcript-comment-sources.js";
  import CommunityTranscriptComments from "../community-transcript-comments/CommunityTranscriptComments.svelte";
  import TranscriptToolDetail from "./TranscriptToolDetail.svelte";
  import { richTranscriptToolProps } from "./rich-transcript-tool-props.js";
  import {
    richTranscriptToolDetail,
    transcriptToolGroupLabel,
    type TranscriptToolEntry,
  } from "./transcript-tool-rich.js";

  type TranscriptTool = Extract<
    CommunityAgentTranscriptEntry,
    { type: "tool" }
  >;
  type TranscriptFocus = { anchor: { recordId: string } } | undefined;

  let {
    items,
    commentSources,
    focus,
    isStreaming,
  }: {
    items: readonly TranscriptTool[];
    commentSources: readonly TranscriptCommentSource[];
    focus?: TranscriptFocus;
    isStreaming: (id: string) => boolean;
  } = $props();

  let rawToolDetails = $state<Record<string, boolean>>({});
  function toolFromCall(call: {
    data?: unknown;
  }): TranscriptToolEntry | undefined {
    const data = call.data;
    return data && typeof data === "object"
      ? (data as TranscriptToolEntry)
      : undefined;
  }
  function rawToolDetail(call: { data?: unknown }): boolean {
    const tool = toolFromCall(call);
    return tool ? rawToolDetails[tool.id] === true : false;
  }
  function toggleToolDetail(tool: TranscriptToolEntry): void {
    rawToolDetails[tool.id] = rawToolDetails[tool.id] !== true;
  }
  function viewToggleLabel(tool: TranscriptToolEntry): string | undefined {
    if (!richTranscriptToolDetail(tool)) return;
    return rawToolDetails[tool.id] ? "Show rich output" : "Show raw output";
  }
  function toolText(tool: TranscriptToolEntry): string {
    return [tool.name, tool.input, tool.output, tool.error]
      .filter(Boolean)
      .join("\n\n");
  }
</script>

{#snippet toolDetail(call: {
  data?: unknown;
  name?: string;
})}<TranscriptToolDetail {call} raw={rawToolDetail(call)} />{/snippet}

<Chat.ToolCalls
  label={transcriptToolGroupLabel(items) ?? "Tool calls"}
  calls={items.map((item) =>
    richTranscriptToolProps(item, toolDetail, !isStreaming(item.id)),
  )}
  expanded={!!focus &&
    commentSources.some(
      (source) =>
        source.record.id === focus.anchor.recordId &&
        items.some((item) => item.id === source.displayId),
    )}
>
  {#snippet callWrapper(call, children)}
    {@const item = items.find((item) => item.toolId === call.id)}
    {#if item}
      {@const sources = commentSources.filter(
        (source) => source.displayId === item.id,
      )}
      <CommunityTranscriptComments
        source={sources[0]}
        related={sources.slice(1)}
        label={`Tool activity: ${item.name}`}
        text={toolText(item)}
        viewToggleLabel={viewToggleLabel(item)}
        onToggleView={() => toggleToolDetail(item)}
      >
        {@render children()}
      </CommunityTranscriptComments>
    {:else}
      {@render children()}
    {/if}
  {/snippet}
</Chat.ToolCalls>
