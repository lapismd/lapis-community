<script lang="ts">
  import * as Field from "@lapismd/design-core/shadcn/field";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import { editorRuntimeDraft } from "../../community/agent-editor-runtime.js";

  let {
    id,
    pending = false,
    runtimeAgent,
    draft,
    onValueChange,
  }: {
    id: string;
    pending?: boolean;
    runtimeAgent: string;
    draft: ReturnType<typeof editorRuntimeDraft>;
    onValueChange: (value: string) => void;
  } = $props();
</script>

<Field.Field>
  <Field.Label for={id}>Model</Field.Label>
  {#key runtimeAgent}
    <Select.Root
      type="single"
      value={draft.selection.model}
      onValueChange={onValueChange}
      disabled={pending}
    >
      <Select.Trigger {id}>{draft.modelTriggerLabel}</Select.Trigger>
      <Select.Content side="top">
        {#each draft.modelOptions as option (option.value)}
          <Select.Item value={option.value}>{option.name}</Select.Item>
        {:else}
          <Select.Item value="__empty__" disabled
            >{draft.modelTriggerLabel}</Select.Item
          >
        {/each}
      </Select.Content>
    </Select.Root>
  {/key}
  {#if draft.catalog?.error}
    <Field.Error>{draft.catalog.error}</Field.Error>
  {/if}
</Field.Field>
