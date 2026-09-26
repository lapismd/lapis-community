import { expect, userEvent, within } from "storybook/test";

import {
  expectCenteredFieldLabelByPath,
  must,
} from "./RegistryReleaseEditForm.stories-helper.test.js";

type Canvas = ReturnType<typeof within>;

export async function expectDetailsControlChrome(
  host: HTMLElement,
): Promise<void> {
  await expectCenteredFieldLabelByPath(host, "plugin.platforms");
  await expectFlatTagFieldByPath(host, "plugin.categories");
  await expectFlatTagFieldByPath(host, "plugin.platforms");
  await expectStatusPickerChrome(host);
}

export async function expectReleasePlatformTagChrome(
  host: HTMLElement,
): Promise<void> {
  await expectCenteredFieldLabelByPath(host, "release.platforms");
  await expectCenteredFieldLabelByPath(host, "release.changelog.tags");
  await expectFlatTagFieldByPath(host, "release.platforms");
  await expectFlatTagFieldByPath(host, "release.changelog.tags");
}

export async function expectPreviewModeToggle(
  canvas: Canvas,
): Promise<HTMLElement> {
  const toggle = canvas.getByRole("button", { name: "Preview release card" });
  await expect(
    must(
      toggle.querySelector('[data-preview-mode-icon="book-open"]'),
      "Expected Book Open preview icon",
    ),
  ).toBeVisible();
  return toggle;
}

export async function expectPreviewCardChrome(
  canvas: Canvas,
  previewArticle: HTMLElement,
): Promise<void> {
  await expect(
    canvas.queryByRole("tablist", { name: "Release edit areas" }),
  ).not.toBeInTheDocument();
  const preview = within(previewArticle);
  await expect(preview.getAllByText(/for teams/u).length).toBeGreaterThan(0);

  const releasesTab = preview.getByRole("tab", { name: /Releases\s+2/u });
  const countChip = must(
    within(releasesTab)
      .getByText("2")
      .closest<HTMLElement>('[data-ui-part="community-chip"]'),
    "Expected releases count chip",
  );
  const countStyle = getComputedStyle(countChip);
  await expect(countStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  await expect(countStyle.borderBlockStartStyle).toBe("solid");

  await userEvent.click(preview.getByRole("tab", { name: "Changelog" }));
  await expect(
    await preview.findByRole("article", { name: /0\.8\.0-beta\.2 changelog/u }),
  ).toBeVisible();
  await expect(
    preview.getByRole("heading", { name: "Better defaults, smoother DX" }),
  ).toBeVisible();
  await expect(preview.getByText("--watch")).toBeVisible();
}

async function expectFlatTagFieldByPath(
  host: HTMLElement,
  path: string,
): Promise<void> {
  const tagField = must(
    host.querySelector<HTMLElement>(`[data-field-path="${path}"]`),
    `Expected ${path} tag field`,
  );
  const autocomplete = must(
    tagField.querySelector<HTMLElement>(
      '[data-ui-component="chip-autocomplete"]',
    ),
    `Expected ${path} tag autocomplete`,
  );
  const box = must(
    autocomplete.querySelector<HTMLElement>(".chip-autocomplete-box"),
    `Expected ${path} tag autocomplete box`,
  );
  const input = must(
    autocomplete.querySelector<HTMLInputElement>("input"),
    `Expected ${path} tag autocomplete input`,
  );
  await expect(getComputedStyle(autocomplete).paddingInlineStart).toBe("0px");
  await expect(getComputedStyle(box).borderInlineStartWidth).toBe("0px");
  await expect(getComputedStyle(box).borderBlockStartWidth).toBe("0px");
  await expect(getComputedStyle(box).paddingInlineStart).toBe("0px");
  await expect(getComputedStyle(input).paddingInlineStart).toBe("0px");
}

async function expectStatusPickerChrome(host: HTMLElement): Promise<void> {
  const statusField = must(
    host.querySelector<HTMLElement>('[data-field-path="plugin.status"]'),
    "Expected status field",
  );
  const trigger = within(statusField).getByRole("button", { name: "Status" });
  await expect(
    must(trigger.querySelector("svg"), "Expected status trigger icon"),
  ).toBeVisible();
  await expect(getComputedStyle(trigger).color).not.toBe(
    getComputedStyle(host).color,
  );
  await userEvent.click(trigger);

  const optionStyles = new Set<string>();
  for (const label of [
    "Pending",
    "Active",
    "Deprecated",
    "Disabled",
    "Revoked",
  ]) {
    const option = within(statusField).getByRole("button", { name: label });
    await expect(option.querySelector("svg")).toBeVisible();
    optionStyles.add(getComputedStyle(option).color);
  }
  await expect(optionStyles.size).toBeGreaterThanOrEqual(4);
  await userEvent.click(trigger);
}
