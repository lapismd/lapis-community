import { expect, userEvent, within } from "storybook/test";

export function expectPermissionCard(controls: HTMLElement) {
  const scoped = within(controls);
  const allow = scoped.getByRole("button", { name: "Allow once" });
  expect(allow.closest('[data-ui-component="button-group"]')).not.toBeNull();
  expect(
    controls.querySelector('[data-ui-component="code-block"]')?.textContent,
  ).toContain("pnpm test");
  expect(scoped.getByRole("button", { name: "Deny once" })).toHaveAttribute(
    "data-variant",
    "destructive",
  );
  return allow;
}

export async function expectExpiredPermissionHidden(
  controls: HTMLElement,
) {
  const scoped = within(controls);
  expect(scoped.queryByText("Waiting for approval")).toBeNull();
  expect(scoped.queryByRole("button", { name: "Allow once" })).toBeNull();
  expect(scoped.queryByRole("button", { name: "Deny once" })).toBeNull();
}

export async function playClearAgentHistory(
  canvas: Pick<ReturnType<typeof within>, "getByRole" | "getByText">,
  canvasElement: HTMLElement,
) {
  await expect(
    canvas.getByRole("button", { name: "Clear this agent’s saved activity" }),
  ).toHaveAttribute("data-variant", "destructive");
  await userEvent.click(
    canvas.getByRole("button", { name: "Clear this agent’s saved activity" }),
  );
  const dialog = within(canvasElement.ownerDocument.body).getByRole(
    "alertdialog",
  );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /^Clear history$/ }),
    );
  await expect(canvas.getByText("No saved activity here yet")).toBeVisible();
}
