<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

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
    const trigger = canvas.getByRole("button", { name: /Open screenshot 1/u });
    await userEvent.click(trigger);
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(
      overlay.getByRole("dialog", { name: "AI Assistant media viewer" }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("button", { name: "Split" }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(overlay.getByRole("button", { name: "Light" }));
    await expect(overlay.getByRole("dialog")).toHaveAttribute(
      "data-media-mode",
      "light",
    );
    await userEvent.click(overlay.getByRole("button", { name: "Next image" }));
    await expect(overlay.getByText(/2 of 2:/u)).toBeVisible();
    await expect(
      overlay.getByRole("button", { name: "Next image" }),
    ).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  }}
/>
