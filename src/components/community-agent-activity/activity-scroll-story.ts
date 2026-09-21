import { expect, userEvent, waitFor, within } from "storybook/test";

function activityViewport(root: HTMLElement): HTMLElement {
  const viewport = root.querySelector<HTMLElement>(
    '[data-ui-component="ai-chat-layout"] [data-ui-part="scroll-area-viewport"]',
  );
  if (!viewport) throw new Error("Activity layout viewport is missing");
  return viewport;
}

export async function playActivityScrollToLatest({
  canvas,
  canvasElement,
}: {
  canvas: ReturnType<typeof within>;
  canvasElement: HTMLElement;
}): Promise<void> {
  const viewport = activityViewport(canvasElement);
  await waitFor(() => {
    expect(canvas.getByText(/Newest activity message/)).toBeVisible();
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight + 80);
    expect(
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
    ).toBeLessThan(40);
  });
  expect(
    canvas.getByText(/Oldest activity message/).getBoundingClientRect().bottom,
  ).toBeLessThan(viewport.getBoundingClientRect().top + 8);
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1200 }));
  viewport.scrollTop = 0;
  viewport.dispatchEvent(new Event("scroll"));
  await waitFor(() =>
    expect(
      canvas.getByRole("button", { name: "Scroll to latest" }),
    ).toBeVisible(),
  );
  expect(
    canvas.queryByRole("button", { name: "New messages" }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    canvas.getByRole("button", { name: "Receive later activity" }),
  );
  await waitFor(() =>
    expect(canvas.getByRole("button", { name: "New messages" })).toBeVisible(),
  );
  await userEvent.click(canvas.getByRole("button", { name: "New messages" }));
  await waitFor(() =>
    expect(
      canvas.queryByRole("button", { name: "New messages" }),
    ).not.toBeInTheDocument(),
  );
  await expect(canvas.getByText(/Later activity message 0/)).toBeVisible();
}
