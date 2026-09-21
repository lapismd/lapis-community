import type { EditorModelRow } from "./agent-editor-model-rows.js";

export function editorHarnessTabs(
  rows: readonly EditorModelRow[],
): { id: string; label: string }[] {
  const tabs: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.runtimeAgent)) continue;
    seen.add(row.runtimeAgent);
    tabs.push({ id: row.runtimeAgent, label: row.harnessLabel });
  }
  return tabs;
}

export function editorHarnessTab(
  tabs: readonly { id: string }[],
  chosenTab: string,
  runtimeAgent: string,
): string {
  if (tabs.some((tab) => tab.id === chosenTab)) return chosenTab;
  if (tabs.some((tab) => tab.id === runtimeAgent)) return runtimeAgent;
  return tabs[0]?.id ?? "";
}

export function editorRowsForHarness(
  rows: readonly EditorModelRow[],
  harness: string,
): readonly EditorModelRow[] {
  return rows.filter((row) => row.runtimeAgent === harness);
}
