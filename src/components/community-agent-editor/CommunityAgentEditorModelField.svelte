<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import * as Field from "@lapismd/design-core/shadcn/field";
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

  const emptyLabel = $derived(
    draft.modelOptions.length === 0
      ? draft.modelTriggerLabel
      : "No matching models.",
  );
  const selectedName = $derived(
    draft.modelOptions.find((option) => option.value === draft.selection.model)
      ?.name,
  );
</script>

<Field.Field>
  <Field.Label for={id}>Model</Field.Label>
  {#key runtimeAgent}
    <div
      class="agent-editor__model-picker"
      data-ui-part="agent-editor-model-picker"
    >
      <CommandView.Root label="Search models" loop>
        <CommandView.Input
          {id}
          aria-label="Search models"
          placeholder="Search models…"
          disabled={pending}
        />
        <CommandView.List>
          <CommandView.Empty>{emptyLabel}</CommandView.Empty>
          {#if draft.modelOptions.length > 0}
            <CommandView.Group heading="Available models">
              {#each draft.modelOptions as option (option.value)}
                <CommandView.Item
                  value={`${option.name} ${option.value} ${option.description ?? ""}`.trim()}
                  keywords={[
                    option.name,
                    option.value,
                    option.description ?? "",
                  ]}
                  disabled={pending}
                  data-active={draft.selection.model === option.value
                    ? ""
                    : undefined}
                  onSelect={() => onValueChange(option.value)}
                >
                  <CommandView.ItemIcon>
                    {#if draft.selection.model === option.value}
                      <CheckIcon
                        class="agent-editor__model-selected-icon"
                        aria-hidden="true"
                      />
                    {/if}
                  </CommandView.ItemIcon>
                  <CommandView.ItemLabel>{option.name}</CommandView.ItemLabel>
                  {#if option.description}
                    <CommandView.ItemDescription
                      >{option.description}</CommandView.ItemDescription
                    >
                  {/if}
                </CommandView.Item>
              {/each}
            </CommandView.Group>
          {/if}
        </CommandView.List>
      </CommandView.Root>
    </div>
  {/key}
  {#if draft.catalog?.error}
    <Field.Error>{draft.catalog.error}</Field.Error>
  {/if}
  {#if selectedName}
    <Field.Description>Selected model: {selectedName}</Field.Description>
  {/if}
</Field.Field>

<style>
  .agent-editor__model-picker {
    --ui-command-view-list-max-height: min(16rem, 50dvh);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
  }
  :global(.agent-editor__model-selected-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
