<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import {
    registryStoryEntries,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import RegistryPluginDetail from "./RegistryPluginDetail.svelte";

  const resolved = registryStoryResolvedDetail();
  const { Story } = defineMeta({
    title: "Community/Registry/Plugin Detail",
    component: RegistryPluginDetail,
    tags: ["visual-pending"],
    args: {
      resolved,
      related: registryStoryEntries.slice(1, 4),
      installAction: { state: "available" },
      onInstall: fn(),
      onOpenPlugin: fn(),
    },
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryPluginDetail {resolved} {related} installAction={installation[resolved.entry.id]} onInstall={installPlugin} />`,
        },
      },
    },
  });
</script>

<Story
  name="Available plugin"
  play={async ({ args, canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Install in Lapis" }),
    );
    await expect(args.onInstall).toHaveBeenCalledOnce();
    await expect(args.onInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "ai",
        version: "1.4.0",
      }),
    );
    await userEvent.click(canvas.getByRole("tab", { name: "Changelog" }));
    await expect(
      canvas.getByRole("heading", { name: "Changelog" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: /Releases/u }));
    await expect(canvas.getByText("0.9.0")).toBeVisible();
  }}
/>

<Story name="Installing" args={{ installAction: { state: "installing" } }} />
<Story name="Installed" args={{ installAction: { state: "installed" } }} />
<Story
  name="Disabled"
  args={{
    installAction: {
      state: "disabled",
      reason: "Not compatible with this app version",
    },
  }}
/>
<Story
  name="Rejected"
  args={{
    installAction: {
      state: "rejected",
      reason: "The host rejected the verified bundle",
    },
  }}
/>
