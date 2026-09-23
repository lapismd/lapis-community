import { expect, waitFor, within } from "storybook/test";

export async function profileActionFeedback(
  {
    canvas,
  }: {
    canvas: ReturnType<typeof within>;
  },
  browserMode: boolean,
) {
  // CSS :hover needs a real pointer. Storybook's synthetic userEvent only
  // dispatches events; use the browser provider in the automated acceptance lane.
  const pointer = browserMode
    ? (await import("vitest/browser")).userEvent
    : undefined;
  for (const name of ["Message", "Follow"]) {
    const button = canvas.getByRole("button", { name, exact: true });
    if (pointer) await pointer.unhover(button);
    const icon = button.querySelector("svg")!;
    const idle = getComputedStyle(icon).backgroundColor;
    if (pointer) {
      await pointer.hover(button);
      await expect(button.matches(":hover")).toBe(true);
      await waitFor(() =>
        expect(getComputedStyle(icon).backgroundColor).not.toBe(idle),
      );
      await pointer.unhover(button);
    }
    button.focus();
    await expect(button).toHaveFocus();
    await expect(getComputedStyle(icon).backgroundColor).not.toBe(idle);
    button.blur();
  }
}
