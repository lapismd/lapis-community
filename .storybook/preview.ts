import type { Preview } from "@storybook/svelte-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { syncCatalogStoryLayout } from "@lapismd/design-core/storybook/catalog-layout";

import "@lapismd/design-core/storybook.css";
import "@lapismd/design-core/themes/lapis.css";
import "./preview.css";

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
  },
  initialGlobals: {
    colorMode: "light",
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
          ["Registry", ["Header", "Summary", "Plugin reactions"], "Discussion"],
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
      }
      return story();
    },
  ],
};

export default preview;
