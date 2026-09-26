import { expect, userEvent, within } from "storybook/test";

import { must } from "./RegistryReleaseEditForm.stories-helper.test.js";

export async function editContentShaReferences(
  host: HTMLElement,
  overviewSha256: string,
  changelogSha256: string,
): Promise<void> {
  await editShaReferenceField(
    host,
    "content.overview.sha256",
    "Overview SHA-256",
    overviewSha256,
  );
  await editShaReferenceField(
    host,
    "content.changelog.sha256",
    "Changelog SHA-256",
    changelogSha256,
  );
}

async function editShaReferenceField(
  host: HTMLElement,
  path: string,
  label: string,
  nextValue: string,
): Promise<void> {
  const row = must(
    host.querySelector<HTMLElement>(
      `[data-field-path="${path}"] [data-ui-part="form-field"]`,
    ),
    `Expected ${label} row`,
  );
  const referenceRow = must(
    host.querySelector<HTMLElement>(
      `[data-field-path="${path.replace(".sha256", ".url")}"] [data-ui-part="form-field"]`,
    ),
    `Expected ${label} reference row`,
  );
  const referenceInput = must(
    referenceRow.querySelector<HTMLElement>("input, textarea"),
    `Expected ${label} reference input`,
  );
  const preview = await expectShaSplitButton(row, label, "0".repeat(64));
  await expect(
    Math.abs(
      preview.closest<HTMLElement>(".registry-release-editable-sha__split")!
        .getBoundingClientRect().left -
        referenceInput.getBoundingClientRect().left,
    ),
  ).toBeLessThanOrEqual(2);
  await userEvent.click(preview);
  const input = within(row).getByRole("textbox", { name: label });
  await userEvent.clear(input);
  await userEvent.type(input, nextValue);
  await userEvent.tab();
}

export async function expectShaSplitButton(
  host: HTMLElement,
  label: string,
  value: string,
): Promise<HTMLElement> {
  const preview = within(host).getByRole("button", {
    name: `Edit ${label}: ${value}`,
  });
  const copy = within(host).getByRole("button", {
    name: `Copy ${label}: ${value}`,
  });
  const split = must(
    preview.closest<HTMLElement>(".registry-release-editable-sha__split"),
    "Expected SHA split button",
  );
  const previewCode = must(
    preview.querySelector<HTMLElement>("code"),
    "Expected SHA preview code",
  );
  const style = getComputedStyle(split);
  await expect(preview).toHaveTextContent(
    `${value.slice(0, 10)}…${value.slice(-6)}`,
  );
  await expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  await expect(
    Number.parseFloat(getComputedStyle(preview).paddingInlineStart),
  ).toBeGreaterThanOrEqual(6);
  await expect(previewCode.getBoundingClientRect().left).toBeGreaterThan(
    split.getBoundingClientRect().left,
  );
  await expect(copy.querySelector('[data-ui-part="copy-icon"]')).not.toBeNull();
  await expect(copy.getBoundingClientRect().left).toBeGreaterThan(
    preview.getBoundingClientRect().left,
  );
  return preview;
}
