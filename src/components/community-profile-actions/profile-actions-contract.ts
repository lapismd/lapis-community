import { expect, userEvent, within } from "storybook/test";

export async function playProfileActionsContract(
  canvas: ReturnType<typeof within>,
) {
  const group = canvas.getByRole("group", { name: "Agent actions" });
  const [stop, reset] = canvas.getAllByRole("button");
  const resetBox = reset.getBoundingClientRect();
  expect(
    Math.abs(stop.getBoundingClientRect().top - resetBox.top),
  ).toBeLessThan(1);
  expect(`${Math.round(resetBox.width)}x${Math.round(resetBox.height)}`).toBe(
    "210x120",
  );
  expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
  await userEvent.click(stop);
  await expect(canvas.getByRole("status")).toHaveTextContent(
    "Cancellation requested",
  );
}
