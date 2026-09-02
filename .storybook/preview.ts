import type { Preview } from "@storybook/svelte-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { syncCatalogStoryLayout } from "@lapismd/design-core/storybook/catalog-layout";

import "@lapismd/design-core/storybook.css";
import "@lapismd/design-core/themes/lapis.css";
import "./preview.css";

const communityRelayUrl = (
  import.meta as ImportMeta & {
    env?: { VITE_COMMUNITY_RELAY_URL?: string };
  }
).env?.VITE_COMMUNITY_RELAY_URL;

const preview: Preview = {
  tags: ["autodocs", "test"],
  globalTypes: {
    theme: {
      description: "Brand theme",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "default", title: "Default" },
          { value: "lapis", title: "Lapis" },
        ],
        dynamicTitle: true,
      },
    },
    communityBackend: {
      description: "Community relay backend",
      toolbar: {
        icon: "database",
        items:
          communityRelayUrl === undefined || communityRelayUrl === ""
            ? [{ value: "memory", title: "In-memory relay" }]
            : [
                { value: "memory", title: "In-memory relay" },
                { value: "docker", title: "Docker relay" },
              ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    colorMode: "light",
    communityBackend: "memory",
    theme: "default",
  },
  parameters: {
    layout: "padded",
    controls: { matchers: { color: /(background|color)$/i } },
    docs: { toc: true },
    a11y: { test: "error" },
    backgrounds: { disable: true },
    themes: { disable: true },
    options: {
      storySort: {
        order: [
          "Community",
          [
            "Navigation",
            ["Sidebar", "Community Switcher"],
            "Inbox",
            "Channels",
            [
              "Conversation",
              "Message",
              "Thread Panel",
              "Channel Settings",
              "Details",
            ],
            "Forums",
            "Discussion",
            "Registry",
            ["Header", "Summary", "Plugin Reactions"],
            "Examples",
            ["App Shell"],
          ],
        ],
      },
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: {
        default: "default",
        lapis: "lapis",
      },
      defaultTheme: "default",
      attributeName: "data-ui-theme",
    }),
    (story, context) => {
      if (typeof document !== "undefined") {
        syncCatalogStoryLayout(document, context);
        document.documentElement.classList.toggle(
          "dark",
          context.globals.colorMode === "dark",
        );
        document.documentElement.dataset.communityBackend =
          context.globals.communityBackend === "docker" ? "docker" : "memory";
        if (communityRelayUrl === undefined || communityRelayUrl === "") {
          delete document.documentElement.dataset.communityRelayUrl;
        } else {
          document.documentElement.dataset.communityRelayUrl =
            communityRelayUrl;
        }
      }
      return story();
    },
  ],
};

export default preview;
