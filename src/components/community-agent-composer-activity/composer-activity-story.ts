import { expect, userEvent, within } from "storybook/test";
import { storyAgent } from "../community-agents/story-fixtures.js";

export async function playLatestComposerActivity({
  canvas,
  args,
}: {
  canvas: ReturnType<typeof within>;
  args: { onOpen: (...values: unknown[]) => unknown };
}) {
  await expect(canvas.getByRole("status")).toHaveTextContent("Working");
  await expect(
    canvas.getByRole("button", { name: "View Research activity" }),
  ).toBeVisible();
  await userEvent.click(
    canvas.getByRole("button", { name: "View Research activity" }),
  );
  await expect(args.onOpen).toHaveBeenCalledWith(storyAgent.pubkey, {
    kind: "thread",
    channelId: "general",
    threadRootId: "a",
  });
}

export async function playMultipleComposerActivity({
  canvas,
  canvasElement,
}: {
  canvas: ReturnType<typeof within>;
  canvasElement: HTMLElement;
}) {
  await userEvent.click(
    canvas.getByRole("button", { name: "View working agents" }),
  );
  await expect(
    within(canvasElement.ownerDocument.body).getByText("Reviewing changes", {
      exact: true,
    }),
  ).toBeVisible();
}

export async function playPermissionComposerActivity({
  canvas,
}: {
  canvas: ReturnType<typeof within>;
}) {
  await expect(canvas.getByRole("status")).toHaveTextContent(
    "Waiting for your permission",
  );
}

export async function playFailureComposerActivity({
  canvas,
  canvasElement,
}: {
  canvas: ReturnType<typeof within>;
  canvasElement: HTMLElement;
}) {
  const alert = canvas.getByRole("alert", {
    name: /This request was interrupted by a controller restart/,
  });
  const line = canvas.getByTitle(
    "Research: This request was interrupted by a controller restart and was not automatically retried.",
  );
  await expect(alert.scrollWidth).toBeLessThanOrEqual(alert.clientWidth);
  await expect(line.scrollWidth).toBeLessThanOrEqual(line.clientWidth);
  await expect(line.getBoundingClientRect().height).toBeGreaterThan(16);
  await expect(canvasElement.querySelector("[data-state='failed']")).toBe(
    alert,
  );
  await expect(canvas.queryByText("Failed to send")).not.toBeInTheDocument();
}

export async function playThreadScopedComposerActivity({
  canvas,
}: {
  canvas: ReturnType<typeof within>;
}) {
  await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
}
