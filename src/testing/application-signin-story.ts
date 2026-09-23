import { expect, waitFor, within } from "storybook/test";

export async function linkedSignerNavigation({
  canvas,
}: {
  canvas: ReturnType<typeof within>;
}) {
  await waitFor(() =>
    expect(canvas.getByText("Reconnect your Nostr signer")).toBeVisible(),
  );
  const application = canvas.getByTestId("full-community-application");
  await expect(
    canvas.getByRole(
      application.dataset.displayMode === "mobile" ? "group" : "navigation",
      { name: "Application navigation" },
    ),
  ).toBeVisible();
  await expect(
    pageBannerLandmarks(canvas.queryAllByRole("banner")).length,
  ).toBeLessThanOrEqual(1);
  await expect(
    canvas.getByRole("button", { name: "Reconnect signer" }),
  ).toBeEnabled();
}

/** Testing Library includes native headers even inside sectioning content. */
function pageBannerLandmarks(headers: readonly HTMLElement[]): HTMLElement[] {
  return headers.filter(
    (header) =>
      header.getAttribute("role") === "banner" ||
      !header.closest("article, aside, main, nav, section"),
  );
}
