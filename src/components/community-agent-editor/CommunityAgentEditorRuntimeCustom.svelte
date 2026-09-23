<script lang="ts">
  import type { EditorModelRow } from "../../community/agent-editor-model-rows.js";
  import type {
    CommunityAgentRuntimeOption,
    CommunityAgentRuntimeThinking,
  } from "../../community/agent-runtime-contracts.js";
  import { runtimePermissionOptions } from "../../community/agent-runtime-permission.js";
  import CommunityAgentEditorModelField from "./CommunityAgentEditorModelField.svelte";
  import CommunityAgentEditorPermissionField from "./CommunityAgentEditorPermissionField.svelte";
  import CommunityAgentEditorThinkingField from "./CommunityAgentEditorThinkingField.svelte";

  let {
    id,
    pending = false,
    rows,
    runtimeAgent,
    model,
    thinking = "",
    thinkingOptions,
    catalog,
    permissionMode = "",
    onModel,
    onThinking,
    onPermission,
  }: {
    id: string;
    pending?: boolean;
    rows: readonly EditorModelRow[];
    runtimeAgent: string;
    model: string;
    thinking?: string;
    thinkingOptions: readonly CommunityAgentRuntimeOption[];
    catalog: {
      configOptions?: readonly {
        id: string;
        options?: readonly CommunityAgentRuntimeOption[];
      }[];
    } | null | undefined;
    permissionMode?: string;
    onModel: (row: EditorModelRow) => void;
    onThinking: (value: CommunityAgentRuntimeThinking) => void;
    onPermission: (value: string) => void;
  } = $props();

  const permissionOptions = $derived(runtimePermissionOptions(catalog));
</script>

<CommunityAgentEditorModelField
  id={`${id}-runtime-model`}
  {pending}
  {rows}
  {runtimeAgent}
  {model}
  onSelect={(row) => {
    onModel(row);
    onPermission("");
  }}
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
{#if permissionOptions.length > 0}
  <CommunityAgentEditorPermissionField
    id={`${id}-runtime-permission`}
    {pending}
    {permissionMode}
    options={permissionOptions}
    onValueChange={onPermission}
  />
{/if}
