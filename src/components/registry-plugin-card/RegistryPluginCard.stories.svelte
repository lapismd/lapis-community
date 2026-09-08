<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import { registryStoryEntries } from "../registry-browser/story-fixtures.js";
  import RegistryPluginCard from "./RegistryPluginCard.svelte";

  const { Story } = defineMeta({
    title: "Community/Registry/Plugin Card",
    component: RegistryPluginCard,
    tags: ["visual-pending"],
    args: { plugin: registryStoryEntries[0], onOpen: fn() },
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryPluginCard {plugin} onOpen={(plugin) => openPlugin(plugin.id)} />`,
        },
      },
    },
  });
</script>

<Story
  name="Catalog card"
  play={async ({ args, canvas }) => {
    const card = canvas.getByRole("link", { name: "Open AI Assistant" });
    const tags = canvas.getByLabelText("Plugin tags");
    const status = within(tags).getByText("Available");
    await expect(tags.firstElementChild).toBe(status);
    for (const tag of tags.children) {
      await expect(tag).toHaveAttribute("data-ui-component", "badge");
      await expect(tag).toHaveAttribute("data-ui-part", "community-chip");
    }
    await expect(getComputedStyle(status).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await expect(getComputedStyle(status).color).not.toBe(
      getComputedStyle(status).backgroundColor,
    );
    card.focus();
    await expect(card).toHaveFocus();
    await userEvent.click(card);
    await expect(args.onOpen).toHaveBeenCalledOnce();
    await expect(args.onOpen).toHaveBeenCalledWith(registryStoryEntries[0]);
  }}
/>

<Story
  name="List row"
  args={{ plugin: registryStoryEntries[2], variant: "list" }}
/>

<Story
  name="Compact row"
  args={{ variant: "compact" }}
  play={async ({ canvas }) => {
    const card = canvas.getByRole("link", { name: "Open AI Assistant" });
    card.focus();
    await expect(card).toHaveFocus();
  }}
/>

<Story name="Deprecated plugin" args={{ plugin: registryStoryEntries[6] }} />
