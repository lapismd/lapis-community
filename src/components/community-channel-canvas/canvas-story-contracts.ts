import { expect, userEvent, within } from "storybook/test";
export async function staleCanvasContract({
  canvasElement,
}: {
  canvasElement: HTMLElement;
}) {
  const view = within(canvasElement);
  await userEvent.click(view.getByRole("button", { name: "Edit canvas" }));
  const editor = canvasElement.querySelector<HTMLElement>(
    '.cm-content[contenteditable="true"]',
  )!;
  await userEvent.click(editor);
  await userEvent.keyboard(" My draft");
  await userEvent.click(
    view.getByRole("button", { name: "Receive remote revision" }),
  );
  await expect(
    view.getByRole("button", { name: "Save canvas" }),
  ).toBeDisabled();
  await expect(editor.textContent).toContain("My draft");
  await userEvent.click(
    view.getByRole("button", { name: "Review latest canvas" }),
  );
  await expect(
    view.getByRole("heading", { name: "Remote revision" }),
  ).toBeVisible();
  await userEvent.click(
    view.getByRole("button", { name: "Keep draft against this version" }),
  );
  await userEvent.click(view.getByRole("button", { name: "Save canvas" }));
  await expect(view.getByLabelText("Saved canvas")).toHaveTextContent(
    "My draft",
  );
}
