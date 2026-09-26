import { expect, userEvent, waitFor, within } from "storybook/test";

import { expectShaSplitButton } from "./RegistryReleaseEditForm.sha-helper.test.js";

type Canvas = ReturnType<typeof within>;

export async function editBannerMediaSha(
  canvas: Canvas,
  nextValue: string,
): Promise<void> {
  const preview = await expectShaSplitButton(
    document.body,
    "Banner Light SHA-256",
    "0".repeat(64),
  );
  await userEvent.click(preview);
  const input = canvas.getByRole("textbox", {
    name: "Banner Light SHA-256",
  });
  await userEvent.clear(input);
  await userEvent.type(input, nextValue);
  await userEvent.tab();
}

export async function expectMediaTabChrome(
  canvas: Canvas,
  canvasElement: HTMLElement,
): Promise<void> {
  await expect(
    canvas.queryByRole("button", { name: "Collapse Media references" }),
  ).not.toBeInTheDocument();
  const mediaTabList = await canvas.findByRole("tablist", {
    name: "Release media assets",
  });
  await expect(mediaTabList).toBeVisible();
  const mediaSurface = (mediaTabList as HTMLElement).closest(
    ".registry-release-media-tabs__surface",
  ) as HTMLElement | null;
  if (mediaSurface === null) throw new Error("Expected media tab surface");
  const mediaTabListStyle = getComputedStyle(mediaTabList);
  await expect(mediaTabListStyle.borderTopLeftRadius).toBe("0px");
  await expect(mediaTabListStyle.borderTopRightRadius).toBe("0px");
  await expect(mediaTabListStyle.borderBottomRightRadius).toBe("0px");
  await expect(mediaTabListStyle.borderLeftStyle).toBe("solid");
  await expect(mediaTabListStyle.borderBottomStyle).toBe("solid");
  await expect(
    Math.abs(
      mediaTabList.getBoundingClientRect().top -
        mediaSurface.getBoundingClientRect().top,
    ),
  ).toBeLessThanOrEqual(1);
  await expect(
    Math.abs(
      mediaTabList.getBoundingClientRect().right -
        mediaSurface.getBoundingClientRect().right,
    ),
  ).toBeLessThanOrEqual(1);
  const mainMediaTab = canvas.getByRole("tab", { name: "Media" });
  const logoMediaTab = canvas.getByRole("tab", { name: "Logo" });
  const mainMediaTabStyle = getComputedStyle(mainMediaTab);
  const logoMediaTabStyle = getComputedStyle(logoMediaTab);
  await expect(logoMediaTab).toBeVisible();
  await expect(logoMediaTabStyle.fontFamily).toBe(mainMediaTabStyle.fontFamily);
  await expect(logoMediaTabStyle.fontSize).toBe(mainMediaTabStyle.fontSize);
  await expect(logoMediaTabStyle.fontWeight).toBe(mainMediaTabStyle.fontWeight);
  await expect(logoMediaTab.getBoundingClientRect().height).toBeLessThan(
    mainMediaTab.getBoundingClientRect().height,
  );
  await expect(canvas.getByRole("tab", { name: "Banner" })).toBeVisible();
  await expect(canvas.getByRole("tab", { name: "Overview" })).toBeVisible();
  await expect(canvas.getByRole("tab", { name: "Screenshots" })).toBeVisible();
  await expect(
    canvas.queryByRole("button", { name: "Add screenshot" }),
  ).not.toBeInTheDocument();
  const logoPanel = canvasElement
    .querySelector<HTMLElement>('[aria-label="Logo alt text"]')
    ?.closest(".registry-release-media-tabs__surface") as HTMLElement | null;
  if (logoPanel === null || logoPanel === undefined) {
    throw new Error("Expected logo media tab panel");
  }
  const logoPanelStyle = getComputedStyle(logoPanel);
  await expect(logoPanelStyle.borderBlockStartStyle).toBe("solid");
  await expect(
    Number.parseFloat(logoPanelStyle.borderTopLeftRadius),
  ).toBeGreaterThan(0);
}

export async function openBannerMediaLightbox(canvas: Canvas): Promise<void> {
  await userEvent.click(
    canvas.getByRole("button", {
      name: "Open Banner Light image preview",
    }),
  );
  const mediaDialog = await within(document.body).findByRole("dialog", {
    name: "Banner media viewer",
  });
  await expect(mediaDialog).toBeVisible();
  await userEvent.click(
    within(mediaDialog).getByRole("button", {
      name: "Close media viewer",
    }),
  );
  await waitFor(() =>
    expect(
      within(document.body).queryByRole("dialog", {
        name: "Banner media viewer",
      }),
    ).not.toBeInTheDocument(),
  );
  const screenshotsTab = canvas.getByRole("tab", { name: "Screenshots" });
  await waitFor(() => {
    expect(screenshotsTab).not.toBeDisabled();
    expect(getComputedStyle(screenshotsTab).pointerEvents).not.toBe("none");
    expect(getComputedStyle(document.body).pointerEvents).not.toBe("none");
  });
  await userEvent.click(screenshotsTab);
}

export async function expectScreenshotGalleryChrome(
  canvas: Canvas,
  canvasElement: HTMLElement,
): Promise<HTMLElement> {
  const gallery = canvasElement.querySelector<HTMLElement>(
    '[data-ui-part="registry-release-gallery"]',
  );
  const galleryBody = gallery?.closest<HTMLElement>(
    ".registry-release-media-tabs__surface",
  );
  const galleryPreview = gallery?.querySelector<HTMLElement>(
    ".registry-release-image-set__preview",
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
  const galleryBodyStyle = getComputedStyle(galleryBody);
  await expect(galleryBodyStyle.borderBlockStartStyle).toBe("solid");
  await expect(
    Number.parseFloat(galleryBodyStyle.borderTopLeftRadius),
  ).toBeGreaterThan(0);
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
  return addScreenshot;
}
