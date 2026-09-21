<script lang="ts">
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import {
    editorHarnessTab,
    editorHarnessTabs,
    editorRowsForHarness,
  } from "../../community/agent-editor-harness-tabs.js";
  import type { EditorModelRow } from "../../community/agent-editor-model-rows.js";
  import CommunityAgentEditorHarnessIcon from "./CommunityAgentEditorHarnessIcon.svelte";

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

  let chosenTab = $state("");
  const tabs = $derived(editorHarnessTabs(rows));
  const harnessTab = $derived(editorHarnessTab(tabs, chosenTab, runtimeAgent));
  const visibleRows = $derived(editorRowsForHarness(rows, harnessTab));
  const emptyLabel = $derived(
    visibleRows.length === 0 ? "Loading models…" : "No matching models.",
  );
</script>

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
    {#if tabs.length > 0}
      <CommandView.Filters
        label="Harness"
        {tabs}
        value={harnessTab}
        onValueChange={(next) => (chosenTab = next)}
      >
        {#snippet start({ tab })}
          <CommunityAgentEditorHarnessIcon runtimeAgent={tab.id} />
        {/snippet}
      </CommandView.Filters>
    {/if}
    <CommandView.List>
      <CommandView.Empty>{emptyLabel}</CommandView.Empty>
      {#if visibleRows.length > 0}
        <CommandView.Group heading="Models">
          {#each visibleRows as row (`${row.runtimeAgent}:${row.model}:${row.name}`)}
            <CommandView.Item
              value={`${row.name} ${row.model} ${row.harnessLabel}`}
              keywords={row.keywords}
              disabled={pending || row.disabled === true}
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
                <CommunityAgentEditorHarnessIcon
                  runtimeAgent={row.runtimeAgent}
                />
              </CommandView.ItemIcon>
              <CommandView.ItemLabel>{row.name}</CommandView.ItemLabel>
            </CommandView.Item>
          {/each}
        </CommandView.Group>
      {/if}
    </CommandView.List>
  </CommandView.Root>
</div>

<style>
  .agent-editor__model-picker {
    --ui-command-view-list-max-height: min(16rem, 50dvh);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
  }
</style>
