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
  await userEvent.click(scoped.getByRole("button", { name: "Agent harness" }));
  await userEvent.click(body.getByRole("option", { name: "Cursor" }));
  await expect(
    scoped.getByRole("combobox", { name: "Search models" }),
  ).toBeVisible();
  await expect(
    scoped.getByRole("option", { name: "Loading models…" }),
  ).toBeVisible();
  await expect(
    scoped.queryByRole("option", { name: /^Composer 2.5$/ }),
  ).not.toBeInTheDocument();
}
