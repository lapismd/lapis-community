<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";

  import { registryStoryDetail } from "../registry-browser/story-fixtures.js";
  import RegistryMediaGallery from "./RegistryMediaGallery.svelte";

  const detail = registryStoryDetail();
  const { Story } = defineMeta({
    title: "Community/Registry/Media Gallery",
    component: RegistryMediaGallery,
    tags: ["visual-pending"],
    args: { items: detail.gallery ?? [], pluginName: detail.name },
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryMediaGallery items={plugin.gallery} pluginName={plugin.name} />`,
        },
      },
    },
  });
</script>

<Story
  name="Accessible viewer"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /Open screenshot 1/u }),
    );
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(overlay.getByRole("dialog")).toBeVisible();
    await expect(
      overlay.getByRole("heading", { name: "AI Assistant screenshot 1" }),
    ).toBeVisible();
    await userEvent.click(
      overlay.getByRole("button", { name: "Next screenshot" }),
    );
    await expect(
      overlay.getByRole("heading", { name: "AI Assistant screenshot 2" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
  }}
/>
