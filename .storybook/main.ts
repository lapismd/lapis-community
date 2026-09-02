import type { StorybookConfig } from "@storybook/svelte-vite";
import { mergeConfig, type Plugin } from "vite";

function crossOriginIsolationPlugin(): Plugin {
  const applyHeaders = (
    _request: unknown,
    response: { setHeader(name: string, value: string): void },
    next: () => void,
  ): void => {
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    next();
  };
  return {
    name: "lapis-community-cross-origin-isolation",
    configureServer(server) {
      server.middlewares.use(applyHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyHeaders);
    },
  };
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|ts|svelte)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-svelte-csf",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },
  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: { dedupe: ["svelte"] },
      plugins: [crossOriginIsolationPlugin()],
      optimizeDeps: {
        include: ["nostr-tools/filter", "nostr-tools/nip44"],
        exclude: [
          "@tursodatabase/database-wasm",
          "@tursodatabase/database-wasm/bundle",
        ],
      },
      worker: {
        format: "es",
      },
      server: {
        headers: {
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "credentialless",
        },
        watch: { ignored: ["**/storybook-static/**"] },
      },
      preview: {
        headers: {
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "credentialless",
        },
      },
    }),
};

export default config;
