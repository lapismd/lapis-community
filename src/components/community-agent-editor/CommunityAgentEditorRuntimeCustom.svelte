<script lang="ts">
  import type { EditorModelRow } from "../../community/agent-editor-model-rows.js";
  import type {
    CommunityAgentRuntimeOption,
    CommunityAgentRuntimeThinking,
  } from "../../community/agent-runtime-contracts.js";
  import CommunityAgentEditorModelField from "./CommunityAgentEditorModelField.svelte";
  import CommunityAgentEditorThinkingField from "./CommunityAgentEditorThinkingField.svelte";

  let {
    id,
    pending = false,
    rows,
    runtimeAgent,
    model,
    thinking = "",
    thinkingOptions,
    onModel,
    onThinking,
  }: {
    id: string;
    pending?: boolean;
    rows: readonly EditorModelRow[];
    runtimeAgent: string;
    model: string;
    thinking?: string;
    thinkingOptions: readonly CommunityAgentRuntimeOption[];
    onModel: (row: EditorModelRow) => void;
    onThinking: (value: CommunityAgentRuntimeThinking) => void;
  } = $props();
</script>

<CommunityAgentEditorModelField
  id={`${id}-runtime-model`}
  {pending}
  {rows}
  {runtimeAgent}
  {model}
  onSelect={onModel}
/>
{#if thinkingOptions.length > 0}
  <CommunityAgentEditorThinkingField
    id={`${id}-runtime-thinking`}
    {pending}
    {thinking}
    options={thinkingOptions}
    onValueChange={onThinking}
  />
{/if}
