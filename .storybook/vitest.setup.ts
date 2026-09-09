import { afterAll, afterEach, beforeAll } from "vitest";

import { installSvelteRuntimeDiagnosticGuard } from "./svelte-runtime-diagnostics.js";

let restoreSvelteRuntimeDiagnosticGuard: (() => void) | undefined;

beforeAll(() => {
  restoreSvelteRuntimeDiagnosticGuard = installSvelteRuntimeDiagnosticGuard();
});

afterEach(
  () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 20);
        });
      });
    }),
);

afterAll(() => {
  restoreSvelteRuntimeDiagnosticGuard?.();
});
