import { expect, within } from "storybook/test";

import { must } from "./RegistryReleaseEditForm.stories-helper.test.js";

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
  await expect(split.getBoundingClientRect().width).toBeLessThanOrEqual(
    preview.getBoundingClientRect().width +
      copy.getBoundingClientRect().width +
      2,
  );
  return preview;
}
