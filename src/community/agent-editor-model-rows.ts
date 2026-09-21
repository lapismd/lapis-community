import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
import {
  resolveRuntimeCatalog,
  runtimeHarnesses,
  runtimeModelOptions,
} from "./agent-runtime-catalog.js";

export type EditorModelRow = {
  runtimeAgent: string;
  model: string;
  name: string;
  harnessLabel: string;
  keywords: string[];
  disabled?: boolean;
};

export function editorCombinedModelRows(
  runtime?: CommunityAgentRuntimeState,
): readonly EditorModelRow[] {
  return runtimeHarnesses(runtime).flatMap((harness) => {
    const advertised = runtime?.runtimeAgents.find(
      (entry) => entry.id === harness.id,
    );
    const catalog =
      advertised && !advertised.catalog
        ? { agent: harness.id, models: [], configOptions: [] }
        : resolveRuntimeCatalog(runtime, harness.id);
    const models = runtimeModelOptions(catalog);
    if (models.length === 0) {
      const name = catalog?.error
        ? "No models for this harness"
        : "Loading models…";
      return [
        {
          runtimeAgent: harness.id,
          model: "",
          name,
          harnessLabel: harness.label,
          keywords: [name, harness.label, harness.id],
          disabled: true,
        },
      ];
    }
    return models.map((option) => ({
      runtimeAgent: harness.id,
      model: option.value,
      name: option.name,
      harnessLabel: harness.label,
      keywords: [option.name, option.value, harness.label, harness.id],
    }));
  });
}
