import { expect, userEvent, waitFor, within } from "storybook/test";

export async function openEditorCustomize(dialog: HTMLElement) {
  const scoped = within(dialog);
  await userEvent.click(
    scoped.getByRole("tab", { name: "Customize for this agent" }),
  );
  return scoped;
}

export async function playEmptyModelCatalog({
  canvasElement,
}: {
  canvasElement: HTMLElement;
}) {
  const body = within(canvasElement.ownerDocument.body);
  const dialog = body.getByRole("dialog", { name: "Edit agent" });
  const scoped = await openEditorCustomize(dialog);
  await expect(
    scoped.getByRole("combobox", { name: "Search models" }),
  ).toBeVisible();
  await userEvent.click(scoped.getByRole("tab", { name: "Cursor" }));
  await expect(
    scoped.getAllByRole("option", { name: /Loading models/ }).length,
  ).toBeGreaterThan(0);
  await expect(
    scoped.queryByRole("option", { name: /Composer 2.5$/ }),
  ).not.toBeInTheDocument();
}

export async function playRefreshEmptyCatalog({
  canvasElement,
  args,
}: {
  canvasElement: HTMLElement;
  args: { onLoadRuntime: { mock: { calls: unknown[] } } };
}) {
  const body = within(canvasElement.ownerDocument.body);
  const dialog = body.getByRole("dialog", { name: "Edit agent" });
  await expect(within(dialog).getByLabelText("Agent name")).toBeEnabled();
  await waitFor(() => expect(args.onLoadRuntime.mock.calls).toHaveLength(1));
  const scoped = await openEditorCustomize(dialog);
  await expect(
    scoped.getByRole("combobox", { name: "Search models" }),
  ).toBeVisible();
  await expect(
    scoped.getAllByRole("option", { name: /Loading models/ }).length,
  ).toBeGreaterThan(0);
}

export async function playRefreshSelectedHarnessCatalog({
  canvasElement,
  args,
}: {
  canvasElement: HTMLElement;
  args: { onLoadRuntime: { mock: { calls: unknown[] } } };
}) {
  const body = within(canvasElement.ownerDocument.body);
  const dialog = body.getByRole("dialog", { name: "Edit agent" });
  const scoped = await openEditorCustomize(dialog);
  await waitFor(() => expect(args.onLoadRuntime.mock.calls).toHaveLength(1));
  await expect(
    scoped.getByRole("combobox", { name: "Search models" }),
  ).toBeVisible();
  await userEvent.click(scoped.getByRole("tab", { name: "Cursor" }));
  await expect(
    scoped.getAllByRole("option", { name: /Loading models/ }).length,
  ).toBeGreaterThan(0);
}

export async function playHarnessModelCatalog({
  canvasElement,
  args,
}: {
  canvasElement: HTMLElement;
  args: { onSaveRuntime: (...input: unknown[]) => unknown };
}) {
  const body = within(canvasElement.ownerDocument.body);
  const dialog = body.getByRole("dialog", { name: "Edit agent" });
  const scoped = await openEditorCustomize(dialog);
  const search = scoped.getByRole("combobox", { name: "Search models" });
  const picker = dialog.querySelector<HTMLElement>(
    '[data-ui-part="agent-editor-model-picker"]',
  )!;
  await expect(search).toBeVisible();
  await expect(scoped.getByRole("tablist", { name: "Harness" })).toBeVisible();
  await expect(scoped.getByRole("tab", { name: "Codex" })).toBeVisible();
  await expect(scoped.getByRole("tab", { name: "Cursor" })).toBeVisible();
  await expect(scoped.getByRole("tab", { name: "OpenCode" })).toBeVisible();
  await expect(scoped.getByRole("option", { name: /GPT-6/ })).toBeVisible();
  await expect(
    scoped.queryByRole("option", { name: /Composer 2.5 Fast/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(scoped.getByRole("tab", { name: "Cursor" }));
  const viewport = within(picker)
    .getByRole("listbox")
    .closest<HTMLElement>('[data-ui-part="scroll-area-viewport"]')!;
  await expect(viewport.getBoundingClientRect().height).toBeLessThanOrEqual(256);
  await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
  await userEvent.type(search, "Composer");
  await expect(
    scoped.getByRole("option", { name: /Composer 2.5 Fast/ }),
  ).toBeVisible();
  await expect(
    scoped.queryByRole("option", { name: /^GPT-6/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    scoped.getByRole("option", { name: /Composer 2.5 Fast/ }),
  );
  await expect(
    scoped.getByText("Selected model: Composer 2.5 Fast"),
  ).toBeVisible();
  await expect(scoped.queryByLabelText("Thinking")).not.toBeInTheDocument();
  await userEvent.click(scoped.getByRole("button", { name: "Save changes" }));
  await expect(args.onSaveRuntime).toHaveBeenCalledWith({
    runtimeAgent: "cursor",
    model: "composer-2.5-fast",
  });
}
