import { expect, userEvent, within } from "storybook/test";

export async function playEmptyModelCatalog({
  canvasElement,
}: {
  canvasElement: HTMLElement;
}) {
  const body = within(canvasElement.ownerDocument.body);
  const dialog = body.getByRole("dialog", { name: "Edit agent" });
  const scoped = within(dialog);
  await userEvent.click(
    scoped.getByRole("tab", { name: "Customize for this agent" }),
  );
  await expect(
    scoped.getByRole("combobox", { name: "Search models" }),
  ).toBeVisible();
  await expect(
    scoped.getAllByRole("option", { name: /Loading models/ }).length,
  ).toBeGreaterThan(0);
  await expect(
    scoped.queryByRole("option", { name: /Composer 2.5$/ }),
  ).not.toBeInTheDocument();
}
