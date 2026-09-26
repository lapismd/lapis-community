<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import {
    editBannerMediaSha,
    expectMediaTabChrome,
    expectScreenshotGalleryChrome,
    openBannerMediaLightbox,
  } from "./RegistryReleaseEditForm.media-helper.test.js";
  import {
    registryStoryEntries,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import {
    expectCenteredFieldLabelByPath,
    expectEvidenceTab,
    expectHighlightsTabLayout,
    expectProseComposerLayout,
    expectReleaseDateTimeControls,
    expectScrollFrame,
    must,
  } from "./RegistryReleaseEditForm.stories-helper.test.js";
  import RegistryReleaseEditForm from "./RegistryReleaseEditForm.svelte";

  const pendingEntry =
    registryStoryEntries.find((entry) => entry.status === "pending") ??
    registryStoryEntries[0]!;
  const resolved = registryStoryResolvedDetail(pendingEntry);
  const saveDraft = fn();
  const cancelEdit = fn();
  const manifestSha256 = "2".repeat(64);
  const releaseEventId = "1".repeat(64);
  const editedBannerSha256 = "c".repeat(64);

  function lastSavedDraft(): RegistryReleaseEditDraft {
    const calls = saveDraft.mock.calls;
    const lastCall = calls.at(-1);
    if (!lastCall) throw new Error("Expected save callback to be called");
    return lastCall[0] as RegistryReleaseEditDraft;
  }

  const { Story } = defineMeta({
    title: "Community/Registry/Release Edit Form",
    component: RegistryReleaseEditForm,
    tags: ["visual-pending"],
    args: {
      resolved,
      releaseEventId,
      manifestSha256,
      publisherIdentity: "npub1publisherexample",
      onSave: saveDraft,
      onCancel: cancelEdit,
    },
    parameters: {
      layout: "padded",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryReleaseEditForm
  resolved={pendingRelease.preview}
  releaseEventId={pendingRelease.eventId}
  manifestSha256={pendingRelease.manifestSha256}
  publisherIdentity={pendingRelease.publisherNpub}
  onSave={saveDraft}
  onCancel={cancelEdit}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Pending release metadata"
  play={async ({ canvas, canvasElement }) => {
    saveDraft.mockClear();
    cancelEdit.mockClear();

    const name = await canvas.findByLabelText("Plugin name");
    await userEvent.clear(name);
    await userEvent.click(canvas.getByRole("button", { name: "Save draft" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Plugin name is required",
    );
    await expect(saveDraft).not.toHaveBeenCalled();

    await userEvent.type(name, "Bases Lab");
    const nameRow = must(
      name.closest<HTMLElement>('[data-ui-part="form-field"]'),
      "Expected plugin name form row",
    );
    const nameRowStyle = getComputedStyle(nameRow);
    await expect(nameRow.getBoundingClientRect().height).toBeLessThanOrEqual(
      54,
    );
    await expect(nameRowStyle.paddingTop).toBe("12px");
    await expect(nameRowStyle.paddingBottom).toBe("12px");
    const nameControl = must(
      nameRow.querySelector<HTMLElement>(".cv-form-field-control"),
      "Expected plugin name control wrapper",
    );
    await expect(
      Math.abs(
        nameControl.getBoundingClientRect().height -
          name.getBoundingClientRect().height,
      ),
    ).toBeLessThanOrEqual(1);
    const descriptionRow = must(
      canvasElement.querySelector<HTMLElement>(
        '[data-field-path="plugin.description"] [data-ui-part="form-field"]',
      ),
      "Expected description form row",
    );
    const descriptionRowStyle = getComputedStyle(descriptionRow);
    await expect(descriptionRowStyle.borderBlockStartStyle).toBe("solid");
    await expect(
      Number.parseFloat(descriptionRowStyle.borderBlockStartWidth),
    ).toBeGreaterThanOrEqual(0.75);
    await expect(
      Math.abs(
        descriptionRow.getBoundingClientRect().top -
          nameRow.getBoundingClientRect().bottom,
      ),
    ).toBeLessThanOrEqual(1);
    const descriptionComposer = await expectProseComposerLayout(descriptionRow);
    await expect(
      getComputedStyle(
        must(
          descriptionComposer.querySelector<HTMLElement>(".cm-line"),
          "Expected description composer value line",
        ),
      ).color,
    ).toBe(getComputedStyle(name).color);
    await userEvent.keyboard("{End} for teams");
    const editTabList = canvas.getByRole("tablist", {
      name: "Release edit areas",
    });
    const detailsTab = canvas.getByRole("tab", { name: "Details" });
    await expect(editTabList).toBeVisible();
    await expect(detailsTab).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Highlights" })).toBeVisible();
    await expect(
      canvas.queryByRole("tab", { name: "Content" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("tab", { name: "Listing" }),
    ).not.toBeInTheDocument();
    await expect(getComputedStyle(editTabList).overflowX).not.toBe("auto");
    await expect(getComputedStyle(editTabList).flexWrap).toBe("wrap");
    await expect(
      canvas.queryByRole("button", { name: "Collapse Details" }),
    ).not.toBeInTheDocument();
    await expectCenteredFieldLabelByPath(
      canvasElement,
      "plugin.platforms",
    );
    expectScrollFrame(nameRow);
    await userEvent.click(
      canvas.getByRole("button", { name: "Preview release card" }),
    );
    await expect(
      await canvas.findByRole("article", { name: "Bases Lab preview" }),
    ).toBeVisible();
    const previewArticle = canvas.getByRole("article", {
      name: "Bases Lab preview",
    });
    await expect(canvas.queryByLabelText("Plugin name")).not.toBeInTheDocument();
    await expect(within(previewArticle).getAllByText(/for teams/u).length).toBeGreaterThan(0);
    await userEvent.click(
      canvas.getByRole("button", { name: "Edit release form" }),
    );
    await expect(await canvas.findByLabelText("Plugin name")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Highlights" }));
    await expect(
      canvas.queryByRole("button", { name: "Collapse Highlights" }),
    ).not.toBeInTheDocument();
    await expectHighlightsTabLayout(canvasElement);
    const highlightEditor = within(
      must(
        canvasElement.querySelector<HTMLElement>(
          '[data-field-path="plugin.highlights"]',
        ),
        "Expected highlights field",
      ),
    ).getAllByRole("textbox", { name: "Markdown editor" })[0]!;
    await userEvent.click(highlightEditor);
    await userEvent.keyboard("{End} for curators");
    await userEvent.click(canvas.getByRole("tab", { name: "Release" }));
    await expect(
      canvas.queryByRole("button", { name: "Collapse Release" }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByLabelText("Minimum app version")).toBeVisible();
    await expectReleaseDateTimeControls(canvasElement);
    await expectCenteredFieldLabelByPath(
      canvasElement,
      "release.platforms",
    );
    await userEvent.click(canvas.getByRole("tab", { name: "Media" }));
    await expectMediaTabChrome(canvas, canvasElement);
    await userEvent.click(canvas.getByRole("tab", { name: /Split/u }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete Logo Split image" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "Add logo image" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Add logo image" }),
    );
    await expect(await canvas.findByLabelText("Logo alt text")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Banner" }));
    await userEvent.click(canvas.getByRole("tab", { name: /Light/u }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete Banner Light image" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "Add Light image" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Add Light image" }),
    );
    await userEvent.clear(canvas.getByLabelText("Banner Light image URL"));
    await userEvent.type(
      canvas.getByLabelText("Banner Light image URL"),
      "https://example.com/banner-light.webp",
    );
    await editBannerMediaSha(canvas, editedBannerSha256);
    await openBannerMediaLightbox(canvas);
    const addScreenshot = await expectScreenshotGalleryChrome(
      canvas,
      canvasElement,
    );

    await userEvent.click(addScreenshot);
    await expect(await canvas.findByText("3 screenshots")).toBeVisible();
    await expect(
      canvasElement.querySelectorAll(
        '[data-ui-part="registry-release-gallery-card"]',
      ),
    ).toHaveLength(1);
    const newAlt = canvas.getByLabelText("Screenshot 3 alt text");
    await userEvent.clear(newAlt);
    await userEvent.type(newAlt, "Command palette screenshot");
    await userEvent.click(canvas.getByRole("tab", { name: /Light/u }));
    await userEvent.click(
      canvas.getByRole("button", { name: "Add Light image" }),
    );
    await userEvent.type(
      canvas.getByLabelText("Screenshot 3 Light image URL"),
      "https://example.com/screenshots/light.webp",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete Screenshot 3 Light image" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "Add Light image" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Add Light image" }),
    );
    await userEvent.type(
      canvas.getByLabelText("Screenshot 3 Light image URL"),
      "https://example.com/screenshots/light.webp",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Previous screenshot" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Previous screenshot" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete screenshot 1" }),
    );
    await expect(await canvas.findByText("2 screenshots")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Evidence" }));
    await expectEvidenceTab(canvas, releaseEventId, manifestSha256);

    await userEvent.click(canvas.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    const saved = lastSavedDraft();
    await expect(saved.plugin.name).toBe("Bases Lab");
    await expect(saved.plugin.description).toContain("for teams");
    await expect(
      saved.plugin.highlights.some((item) => item.includes("for curators")),
    ).toBe(true);
    await expect(saved.media.logo?.images.full).not.toBeNull();
    await expect(saved.media.banner?.images.light?.url).toBe(
      "https://example.com/banner-light.webp",
    );
    await expect(saved.media.banner?.images.light?.sha256).toBe(
      editedBannerSha256,
    );
    await expect(saved.media.gallery).toHaveLength(2);
    await expect(
      saved.media.gallery.some(
        (item) => item.alt === "Command palette screenshot",
      ),
    ).toBe(true);
    await expect(
      saved.media.gallery.find(
        (item) => item.alt === "Command palette screenshot",
      )?.images.light?.url,
    ).toBe("https://example.com/screenshots/light.webp");
    await expect(
      saved.media.gallery.find(
        (item) => item.alt === "Command palette screenshot",
      )?.images.full,
    ).not.toBeNull();
    await expect(saved.evidence.artifactSha256).toBe("0".repeat(64));

    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelEdit).toHaveBeenCalledTimes(1));
    await expect(canvasElement).toBeVisible();
  }}
/>
