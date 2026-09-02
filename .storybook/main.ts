import type { StorybookConfig } from "@storybook/svelte-vite";
import { mergeConfig } from "vite";

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
      optimizeDeps: {
        include: ["nostr-tools/filter", "nostr-tools/nip44"],
      },
      server: { watch: { ignored: ["**/storybook-static/**"] } },
    }),
};

export default config;
