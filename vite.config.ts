import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const packageDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    svelte({
      compilerOptions: { customElement: command === "build" },
    }),
  ],
  optimizeDeps: {
    exclude: [
      "@lapismd/design-core",
      "@lapismd/design-core/ai/chat",
      "@lapismd/design-core/ai/experimental",
      "@lapismd/design-core/shell",
    ],
    include: [
      "aria-query",
      "react",
      "react-dom",
      "react-dom/client",
      "@storybook/addon-a11y/preview",
      "@storybook/svelte-vite",
    ],
    esbuildOptions: { target: "esnext" },
  },
  ssr: { noExternal: ["aria-query"] },
  worker: {
    format: "es",
  },
  build: {
    target: "es2023",
    sourcemap: true,
    emptyOutDir: false,
    outDir: "dist/client",
    lib: {
      entry: "src/components/register.ts",
      formats: ["es"],
      fileName: () => "registry-community.js",
    },
  },
  test: {
    projects: [
      {
        plugins: [svelte()],
        test: {
          name: "unit",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "scripts/**/*.test.mjs",
            ".storybook/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(packageDirectory, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          setupFiles: ["./.storybook/vitest.setup.ts"],
          testTimeout: 60_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              { browser: "chromium", viewport: { width: 1280, height: 800 } },
            ],
          },
        },
      },
    ],
  },
}));
