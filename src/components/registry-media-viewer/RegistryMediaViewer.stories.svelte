<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";

  import { registryStoryDetail } from "../registry-browser/story-fixtures.js";
  import RegistryMediaViewer from "./RegistryMediaViewer.svelte";

  const detail = registryStoryDetail();
  const { Story } = defineMeta({
    title: "Community/Registry/Media Viewer",
    component: RegistryMediaViewer,
    tags: ["visual-pending"],
    args: {
      items: detail.gallery ?? [],
      pluginName: detail.name,
      open: true,
      selectedIndex: 0,
    },
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryMediaViewer items={plugin.gallery} pluginName={plugin.name} bind:open bind:selectedIndex />`,
        },
      },
    },
  });
</script>

<Story
  name="Split light and dark media"
  play={async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = page.getByRole("dialog", {
      name: /AI Assistant media viewer/u,
    });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Split" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(page.getByRole("button", { name: "Light" }));
    await expect(dialog).toHaveAttribute("data-media-mode", "light");
    await userEvent.click(page.getByRole("button", { name: "Dark" }));
    await expect(dialog).toHaveAttribute("data-media-mode", "dark");
    await userEvent.keyboard("{End}");
    await expect(page.getByText(/2 of 2:/u)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next image" }),
    ).toBeDisabled();
    await userEvent.keyboard("{Home}");
    await expect(page.getByText(/1 of 2:/u)).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(dialog).not.toBeVisible();
  }}
/>
