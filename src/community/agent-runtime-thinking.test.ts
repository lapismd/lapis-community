import { describe, expect, it } from "vitest";
import { parseRuntimeCatalog } from "./agent-runtime-catalog-parse.js";
import {
  runtimeCatalogDefaults,
  runtimeSelectionForCatalog,
} from "./agent-runtime-catalog.js";
import { runtimeThinkingOptions } from "./agent-runtime-thinking.js";
import { editorRuntimeSaveInput } from "./agent-editor-runtime-save.js";

const cursorCatalog = {
  agent: "cursor",
  currentModel: "composer-2.5",
  models: ["composer-2.5"],
  configOptions: [
    {
      id: "model",
      name: "Model",
      category: "model",
      currentValue: "composer-2.5",
      options: [{ value: "composer-2.5", name: "Composer 2.5" }],
    },
  ],
};

describe("catalog-driven thinking", () => {
  it("omits thinking when the selected catalog advertises none", () => {
    expect(runtimeCatalogDefaults(cursorCatalog)).toEqual({
      model: "composer-2.5",
    });
    expect(runtimeThinkingOptions(cursorCatalog, "composer-2.5")).toEqual([]);
    expect(
      editorRuntimeSaveInput(
        "cursor",
        { model: "composer-2.5", thinking: "medium" },
        [],
      ),
    ).toEqual({ runtimeAgent: "cursor", model: "composer-2.5" });
  });

  it("keeps advertised thinking and prefers the selected model entry", () => {
    const catalog = parseRuntimeCatalog({
      agent: "opencode",
      currentModel: "opencode/gpt-5",
      models: ["opencode/gpt-5", "opencode/composer"],
      entries: [
        {
          id: "opencode/gpt-5",
          label: "GPT-5",
          thinkingValues: ["low", "high", "xhigh"],
        },
        { id: "opencode/composer", label: "Composer" },
      ],
      configOptions: [
        {
          id: "variant",
          name: "Variant",
          currentValue: "high",
          options: [
            { value: "low", name: "Low" },
            { value: "high", name: "High" },
          ],
        },
      ],
    });
    expect(
      runtimeThinkingOptions(catalog, "opencode/gpt-5").map((o) => o.value),
    ).toEqual(["low", "high", "xhigh"]);
    expect(
      runtimeThinkingOptions(catalog, "opencode/composer").map((o) => o.value),
    ).toEqual(["low", "high"]);
    expect(
      runtimeSelectionForCatalog(catalog, {
        model: "opencode/composer",
        thinking: "xhigh",
      }),
    ).toEqual({ model: "opencode/composer", thinking: "high" });
    expect(
      editorRuntimeSaveInput(
        "opencode",
        { model: "opencode/gpt-5", thinking: "xhigh" },
        runtimeThinkingOptions(catalog, "opencode/gpt-5"),
      ),
    ).toEqual({
      runtimeAgent: "opencode",
      model: "opencode/gpt-5",
      thinking: "xhigh",
    });
  });
});
