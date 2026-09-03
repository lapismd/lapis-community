import { describe, expect, it, vi } from "vitest";

import {
  installSvelteRuntimeDiagnosticGuard,
  isSvelteRuntimeDiagnostic,
} from "./svelte-runtime-diagnostics.js";

describe("Storybook Svelte runtime diagnostics", () => {
  it.each([
    ["[svelte] state_proxy_equality_mismatch\nReactive values differ"],
    ["https://svelte.dev/e/derived_inert"],
    [new Error("https://svelte.dev/e/effect_update_depth_exceeded")],
  ])("recognizes a Svelte diagnostic", (diagnostic) => {
    expect(isSvelteRuntimeDiagnostic([diagnostic])).toBe(true);
  });

  it("ignores unrelated browser performance and application messages", () => {
    expect(
      isSvelteRuntimeDiagnostic([
        "[Violation] Forced reflow while executing JavaScript took 43ms",
      ]),
    ).toBe(false);
    expect(isSvelteRuntimeDiagnostic(["Could not load a relay"])).toBe(false);
  });

  it("turns matching console warnings and errors into failures and restores console", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const restore = installSvelteRuntimeDiagnosticGuard();

    expect(() => console.warn("[Violation] handler took 51ms")).not.toThrow();
    expect(() =>
      console.warn("https://svelte.dev/e/state_proxy_equality_mismatch"),
    ).toThrow(/Svelte runtime diagnostic/u);
    expect(() => console.error("[svelte] derived_inert")).toThrow(
      /Svelte runtime diagnostic/u,
    );

    restore();
    expect(() => console.warn("[svelte] derived_inert")).not.toThrow();
    warn.mockRestore();
    error.mockRestore();
  });
});
