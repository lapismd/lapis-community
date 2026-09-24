import { expect, userEvent, within } from "storybook/test";

export async function playProfileEditor({
  canvas,
  canvasElement,
}: {
  canvas: ReturnType<typeof within>;
  canvasElement: HTMLElement;
}) {
  const editAgent = canvas.getByRole("button", {
    name: "Edit Research",
    exact: true,
  });
  await expect(
    canvas.queryByText("Edit agent", { exact: true }),
  ).not.toBeInTheDocument();
  await expect(
    canvas.getByRole("img", { name: "Research, Online" }),
  ).toHaveAttribute("data-shape", "rounded");
  await userEvent.click(editAgent);
  const body = within(canvasElement.ownerDocument.body);
  const dialog = body.getByRole("dialog", { name: "Edit agent" });
  await expect(
    within(dialog).getByText(
      "A configured controller applies changes before the agent's next idle turn.",
    ),
  ).toBeVisible();
  await userEvent.clear(within(dialog).getByLabelText("Agent name"));
  await userEvent.type(
    within(dialog).getByLabelText("Agent name"),
    "Research assistant",
  );
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Save changes" }),
  );
  await expect(
    canvas.getByRole("heading", { name: "Research assistant", exact: true }),
  ).toBeVisible();
  await expect(canvas.getByText("Runtime defaults saved")).toBeVisible();
}
