import { expect, userEvent, within } from "storybook/test";

export async function expectLogCreateReviewDialog(dialog: HTMLElement) {
  const page = within(dialog.ownerDocument.body);
  await expect(
    within(dialog).getByRole("heading", { name: "Create review" }),
  ).toBeVisible();
  await expect(
    within(dialog).getByRole("combobox", { name: "Base branch" }),
  ).toBeVisible();
  await userEvent.click(
    within(dialog).getByRole("combobox", { name: "Base branch" }),
  );
  await expect(page.queryByRole("tab", { name: "Sync" })).toBeNull();
  await expect(page.getByRole("option", { name: "main" })).toBeVisible();
  await userEvent.click(
    page.getByRole("button", { name: "Close branch switcher" }),
  );
  await expect(
    within(dialog).getByRole("textbox", { name: "Title" }),
  ).toBeVisible();
  await expect(
    await within(dialog).findByRole(
      "group",
      { name: "Review description" },
      { timeout: 10_000 },
    ),
  ).toBeVisible();
  await expect(
    await within(dialog).findByRole(
      "textbox",
      { name: "Markdown editor" },
      { timeout: 10_000 },
    ),
  ).toBeVisible();
  await expect(
    within(dialog).queryByRole("textbox", { name: "Description" }),
  ).toBeNull();
}
