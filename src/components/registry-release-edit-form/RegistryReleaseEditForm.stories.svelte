<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import {
    registryStoryEntries,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import RegistryReleaseEditForm from "./RegistryReleaseEditForm.svelte";

  const pendingEntry =
    registryStoryEntries.find((entry) => entry.status === "pending") ??
    registryStoryEntries[0]!;
  const resolved = registryStoryResolvedDetail(pendingEntry);
  const saveDraft = fn();
  const cancelEdit = fn();
  const manifestSha256 = "2".repeat(64);
  const releaseEventId = "1".repeat(64);

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
    const nameRow = name.closest<HTMLElement>('[data-ui-part="form-field"]');
    if (nameRow === null) {
      throw new Error("Expected plugin name form row");
    }
    const nameRowStyle = getComputedStyle(nameRow);
    await expect(nameRow.getBoundingClientRect().height).toBeLessThanOrEqual(
      54,
    );
    await expect(nameRowStyle.paddingTop).toBe("12px");
    await expect(nameRowStyle.paddingBottom).toBe("12px");
    const nameControl = nameRow.querySelector<HTMLElement>(
      ".cv-form-field-control",
    );
    if (nameControl === null) {
      throw new Error("Expected plugin name control wrapper");
    }
    await expect(
      Math.abs(
        nameControl.getBoundingClientRect().height -
          name.getBoundingClientRect().height,
      ),
    ).toBeLessThanOrEqual(1);
    const descriptionRow = canvas
      .getByLabelText("Description")
      .closest<HTMLElement>('[data-ui-part="form-field"]');
    if (descriptionRow === null) {
      throw new Error("Expected description form row");
    }
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
    await expect(
      canvas.getByRole("button", { name: "Collapse Highlights" }),
    ).toBeVisible();
    const highlightsField = canvasElement.querySelector<HTMLElement>(
      '[data-field-path="plugin.highlights"]',
    );
    if (highlightsField === null) {
      throw new Error("Expected highlights form field");
    }
    const highlightsLabel = highlightsField.querySelector<HTMLElement>(
      '[data-ui-part="list-editor-label"]',
    );
    const highlightsHeader = highlightsField.querySelector<HTMLElement>(
      '[data-ui-part="list-editor-header"]',
    );
    const highlightsItems = highlightsField.querySelector<HTMLElement>(
      '[data-ui-part="list-editor-items"]',
    );
    const highlightsGroupBody = highlightsField.closest<HTMLElement>(
      ".ui-configured-form-group__body",
    );
    const addHighlight = within(highlightsField).getByRole("button", {
      name: "Add highlight",
    });
    if (
      highlightsLabel === null ||
      highlightsHeader === null ||
      highlightsItems === null ||
      highlightsGroupBody === null
    ) {
      throw new Error("Expected highlights list editor chrome");
    }
    const addHighlightStyle = getComputedStyle(addHighlight);
    const highlightsHeaderStyle = getComputedStyle(highlightsHeader);
    const highlightsItemsStyle = getComputedStyle(highlightsItems);
    const highlightsGroupBodyStyle = getComputedStyle(highlightsGroupBody);
    const addHighlightAction = addHighlight.closest<HTMLElement>(
      ".cv-control-action-row",
    );
    if (addHighlightAction === null) {
      throw new Error("Expected add highlight action row");
    }
    const addHighlightActionStyle = getComputedStyle(addHighlightAction);
    const highlightsItemsBox = highlightsItems.getBoundingClientRect();
    const highlightsHeaderBox = highlightsHeader.getBoundingClientRect();
    const addHighlightBox = addHighlight.getBoundingClientRect();
    await expect(getComputedStyle(highlightsLabel).display).toBe("none");
    await expect(highlightsGroupBodyStyle.borderBlockStartWidth).toBe("0px");
    await expect(highlightsItemsStyle.borderBlockStartStyle).toBe("solid");
    await expect(highlightsHeaderStyle.display).toBe("flex");
    await expect(highlightsHeaderStyle.order).toBe("2");
    await expect(highlightsHeaderStyle.justifyContent).toBe("flex-end");
    await expect(highlightsHeaderStyle.borderBlockEndWidth).toBe("0px");
    await expect(addHighlightActionStyle.borderBottomWidth).toBe("0px");
    await expect(highlightsHeaderBox.top).toBeGreaterThanOrEqual(
      highlightsItemsBox.bottom,
    );
    await expect(
      Math.abs(addHighlightBox.right - highlightsItemsBox.right),
    ).toBeLessThanOrEqual(2);
    await expect(addHighlightStyle.borderBlockStartStyle).toBe("dashed");
    await expect(
      canvas.getByRole("tablist", { name: "Release edit areas" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Release" }));
    await expect(
      canvas.queryByRole("button", { name: "Collapse Release" }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByLabelText("Minimum app version")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Media" }));
    await expect(
      canvas.queryByRole("button", { name: "Collapse Media references" }),
    ).not.toBeInTheDocument();
    await expect(
      await canvas.findByRole("button", { name: "Collapse Logo" }),
    ).toBeVisible();
    const logoToggle = canvas.getByRole("button", { name: "Collapse Logo" });
    const logoHeader = logoToggle.closest<HTMLElement>(
      ".cv-form-section-header",
    );
    const logoTitle = logoHeader?.querySelector<HTMLElement>(
      ".cv-form-section-title-toggle",
    );
    if (logoHeader === null || logoHeader === undefined || logoTitle === null) {
      throw new Error("Expected logo media section header");
    }
    await expect(getComputedStyle(logoHeader).display).toBe("flex");
    await expect(
      Math.abs(
        logoToggle.getBoundingClientRect().top -
          logoTitle.getBoundingClientRect().top,
      ),
    ).toBeLessThanOrEqual(4);
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove Logo reference" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Add media reference" }),
    );
    await expect(
      await canvas.findByLabelText("Media reference title"),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Logo" }));
    await expect(
      await canvas.findByRole("button", { name: "Collapse Logo" }),
    ).toBeVisible();
    const gallery = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="registry-release-gallery"]',
    );
    const galleryBody = gallery?.closest<HTMLElement>(
      ".registry-release-media-section__body",
    );
    const galleryPreview = gallery?.querySelector<HTMLElement>(
      ".registry-release-gallery__preview",
    );
    if (
      gallery === null ||
      gallery === undefined ||
      galleryBody === null ||
      galleryBody === undefined ||
      galleryPreview === null ||
      galleryPreview === undefined
    ) {
      throw new Error("Expected screenshot gallery chrome");
    }
    await expect(getComputedStyle(galleryBody).borderBlockStartWidth).toBe(
      "0px",
    );
    await expect(getComputedStyle(galleryPreview).borderBlockStartStyle).toBe(
      "solid",
    );
    await expect(
      canvasElement.querySelectorAll(
        '[data-ui-part="registry-release-gallery-card"]',
      ),
    ).toHaveLength(1);
    const addScreenshot = canvas.getByRole("button", {
      name: "Add screenshot",
    });
    await expect(getComputedStyle(addScreenshot).borderBlockStartStyle).toBe(
      "dashed",
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
    await userEvent.click(
      canvas.getByRole("tab", { name: /Light/u }),
    );
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
    const artifactHash = canvas
      .getByText("Artifact SHA-256")
      .closest<HTMLElement>('[data-ui-part="form-field"]');
    if (artifactHash === null) {
      throw new Error("Expected artifact hash read-only row");
    }
    await expect(
      within(artifactHash).queryByRole("textbox"),
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    const saved = lastSavedDraft();
    await expect(saved.plugin.name).toBe("Bases Lab");
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
