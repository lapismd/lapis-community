<script lang="ts">
  import BotIcon from "@lucide/svelte/icons/bot";
  import MousePointer2Icon from "@lucide/svelte/icons/mouse-pointer-2";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import type { EditorModelRow } from "../../community/agent-editor-model-rows.js";

  let {
    id,
    pending = false,
    rows,
    runtimeAgent,
    model,
    onSelect,
  }: {
    id: string;
    pending?: boolean;
    rows: readonly EditorModelRow[];
    runtimeAgent: string;
    model: string;
    onSelect: (row: EditorModelRow) => void;
  } = $props();

  const emptyLabel = $derived(
    rows.length === 0 ? "Loading models…" : "No matching models.",
  );
  const selected = $derived(
    rows.find(
      (row) =>
        !row.disabled &&
        row.runtimeAgent === runtimeAgent &&
        row.model === model,
    ),
  );

  function harnessIcon(runtimeAgent: string) {
    if (runtimeAgent === "codex") return SparklesIcon;
    if (runtimeAgent === "cursor") return MousePointer2Icon;
    if (runtimeAgent === "opencode") return TerminalIcon;
    return BotIcon;
  }
</script>

<Field.Field>
  <Field.Label for={id}>Model</Field.Label>
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
        {#if rows.length > 0}
          <CommandView.Group heading="Models">
            {#each rows as row (`${row.runtimeAgent}:${row.model}:${row.name}`)}
              {@const Icon = harnessIcon(row.runtimeAgent)}
              <CommandView.Item
                value={`${row.name} ${row.model} ${row.harnessLabel}`}
                keywords={row.keywords}
                disabled={pending || row.disabled}
                data-active={!row.disabled &&
                row.runtimeAgent === runtimeAgent &&
                row.model === model
                  ? ""
                  : undefined}
                onSelect={() => {
                  if (!row.disabled) onSelect(row);
                }}
              >
                <CommandView.ItemIcon>
                  <Icon
                    class="agent-editor__model-harness-icon"
                    aria-hidden="true"
                  />
                </CommandView.ItemIcon>
                <CommandView.ItemLabel>{row.name}</CommandView.ItemLabel>
                <CommandView.ItemDescription
                  >{row.harnessLabel}</CommandView.ItemDescription
                >
              </CommandView.Item>
            {/each}
          </CommandView.Group>
        {/if}
      </CommandView.List>
    </CommandView.Root>
  </div>
  {#if selected}
    <Field.Description>Selected model: {selected.name}</Field.Description>
  {/if}
</Field.Field>

<style>
  .agent-editor__model-picker {
    --ui-command-view-list-max-height: min(16rem, 50dvh);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
  }
  :global(.agent-editor__model-harness-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>
