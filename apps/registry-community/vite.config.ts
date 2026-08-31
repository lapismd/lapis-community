import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte({ compilerOptions: { customElement: true } })],
  build: {
    target: "es2023",
    sourcemap: true,
    lib: {
      entry: "src/register.ts",
      formats: ["es"],
      fileName: () => "registry-community.js",
    },
  },
});
