import type { Preview } from "@storybook/svelte-vite";

import "@lapismd/design-core/storybook.css";
import "@lapismd/design-core/themes/lapis.css";
import "./preview.css";

const preview: Preview = {
  tags: ["autodocs", "test"],
  initialGlobals: {
    colorMode: "dark",
  },
  parameters: {
    layout: "padded",
    a11y: { test: "error" },
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: [
          "Community",
          ["Registry", ["Header", "Summary", "Plugin reactions"], "Discussion"],
        ],
      },
    },
  },
};

export default preview;
