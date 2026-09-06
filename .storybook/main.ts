import type { StorybookConfig } from "@storybook/svelte-vite";
import { mergeConfig, type Plugin } from "vite";

const registryProxyTarget = process.env.VITE_REGISTRY_PROXY_TARGET?.trim();

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
        force: true,
        include: ["nostr-tools/filter", "nostr-tools/nip44"],
        exclude: [
          "@tursodatabase/database-wasm/bundle",
          "@tursodatabase/database-wasm-common",
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
        ...(registryProxyTarget
          ? {
              proxy: {
                "/registry": {
                  target: registryProxyTarget,
                  changeOrigin: true,
                },
              },
            }
          : {}),
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
