<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import { registryStoryDetail } from "../registry-browser/story-fixtures.js";
  import RegistryMediaGallery from "./RegistryMediaGallery.svelte";

  const detail = registryStoryDetail();
  const storyGallery = detail.gallery ?? [];
  const galleryWithPreview = [
    ...storyGallery,
    { ...storyGallery[0]!, id: "third", alt: "Third screenshot preview" },
  ];
  const { Story } = defineMeta({
    title: "Community/Registry/Media Gallery",
    component: RegistryMediaGallery,
    tags: ["visual-pending"],
    args: { items: storyGallery, pluginName: detail.name },
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
    const slides = canvas.getAllByRole("button", { name: /Open screenshot/u });
    const trigger = slides[0]!;
    const frame = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="registry-media-gallery-frame"]',
    )!;
    await expect(slides).toHaveLength(2);
    await expect(slides[0]).toHaveAttribute("data-state", "active");
    await expect(slides[1]).toHaveAttribute("data-state", "active");
    await expect(Number(getComputedStyle(slides[0]!).opacity)).toBe(1);
    await expect(Number(getComputedStyle(slides[1]!).opacity)).toBe(1);
    await expect(slides[1]!.getBoundingClientRect().right).toBeLessThanOrEqual(
      frame.getBoundingClientRect().right + 1,
    );
    await userEvent.click(trigger);
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(
      overlay.getByRole("dialog", { name: "AI Assistant media viewer" }),
    ).toBeVisible();
    await expect(overlay.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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

<Story
  name="Two images with next preview"
  args={{ items: galleryWithPreview }}
  play={async ({ canvas, canvasElement }) => {
    const slides = canvas.getAllByRole("button", { name: /Open screenshot/u });
    const frame = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="registry-media-gallery-frame"]',
    )!;
    await expect(slides).toHaveLength(3);
    await expect(slides[0]).toHaveAttribute("data-state", "active");
    await expect(slides[1]).toHaveAttribute("data-state", "active");
    await expect(slides[2]).toHaveAttribute("data-state", "preview");
    await expect(Number(getComputedStyle(slides[0]!).opacity)).toBe(1);
    await expect(Number(getComputedStyle(slides[1]!).opacity)).toBe(1);
    await expect(Number(getComputedStyle(slides[2]!).opacity)).toBeLessThan(1);
    await expect(slides[2]!.getBoundingClientRect().left).toBeLessThan(
      frame.getBoundingClientRect().right,
    );
    await expect(slides[2]!.getBoundingClientRect().right).toBeGreaterThan(
      frame.getBoundingClientRect().right,
    );
  }}
/>
