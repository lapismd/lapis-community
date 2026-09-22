import { expect, within } from "storybook/test";

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
