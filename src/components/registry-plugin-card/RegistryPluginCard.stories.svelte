<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

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
    await userEvent.click(
      canvas.getByRole("button", { name: "Open AI Assistant" }),
    );
    await expect(args.onOpen).toHaveBeenCalledOnce();
    await expect(args.onOpen).toHaveBeenCalledWith(registryStoryEntries[0]);
  }}
/>

<Story
  name="List row"
  args={{ plugin: registryStoryEntries[2], variant: "list" }}
/>

<Story name="Deprecated plugin" args={{ plugin: registryStoryEntries[6] }} />
