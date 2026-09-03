import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from "@storybook/svelte-vite";
import { afterAll, afterEach, beforeAll } from "vitest";

import * as projectAnnotations from "./preview";
import { installSvelteRuntimeDiagnosticGuard } from "./svelte-runtime-diagnostics.js";

const project = setProjectAnnotations([
  a11yAddonAnnotations,
  projectAnnotations,
]);

beforeAll(project.beforeAll);

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
