import { expect, userEvent, waitFor, within } from "storybook/test";

export async function deleteSavedSetupWithCancellationAndRetry({
  canvas,
  canvasElement,
}: {
  canvas: ReturnType<typeof within>;
  canvasElement: HTMLElement;
}): Promise<void> {
  const body = within(canvasElement.ownerDocument.body);
  const add = canvas.getByRole("button", { name: "Add agent" });
  await waitFor(() =>
    expect(getComputedStyle(add).pointerEvents).not.toBe("none"),
  );
  await userEvent.click(add);
  await userEvent.click(body.getByRole("button", { name: "Saved setups" }));
  const saved = body.getByRole("dialog", { name: "Saved agent setups" });
  await userEvent.click(
    within(saved).getByRole("button", { name: "Delete setup" }),
  );
  let confirmation = body.getByRole("alertdialog", {
    name: "Delete Release notes setup?",
  });
  await userEvent.click(
    within(confirmation).getByRole("button", { name: "Cancel" }),
  );
  await waitFor(() => expect(confirmation).not.toBeInTheDocument());
  await expect(within(saved).getByText("Release notes")).toBeVisible();
  await userEvent.click(
    within(saved).getByRole("button", { name: "Delete setup" }),
  );
  confirmation = body.getByRole("alertdialog", {
    name: "Delete Release notes setup?",
  });
  await userEvent.click(
    within(confirmation).getByRole("button", { name: "Delete setup" }),
  );
  await waitFor(() =>
    expect(
      body.getByText("Relay denied the request. Please retry."),
    ).toBeVisible(),
  );
  confirmation = await waitFor(() => {
    const current = body.getByRole("alertdialog", {
      name: "Delete Release notes setup?",
    });
    expect(current).toBeVisible();
    return current;
  });
  await expect(
    within(confirmation).queryByRole("alert"),
  ).not.toBeInTheDocument();
  await userEvent.click(
    within(confirmation).getByRole("button", { name: "Delete setup" }),
  );
  await waitFor(() =>
    expect(body.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  await expect(within(saved).getByText("No saved setups.")).toBeVisible();
  await userEvent.click(
    within(saved).getByRole("button", { name: /^Close$/u }),
  );
  await expect(
    canvas.getByRole("button", { name: "View Research" }),
  ).toBeVisible();
}
