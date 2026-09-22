import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";

import { projectStoryRepositoryCoordinate } from "../community-projects/story-fixtures.js";
import { projectRouteToHash } from "./navigation.js";

type StoryCanvas = ReturnType<typeof within>;

export async function playChannelEntityHashes({
  canvas,
  canvasElement,
}: {
  canvas: StoryCanvas;
  canvasElement: HTMLElement;
}): Promise<void> {
  const application = await canvas.findByTestId(
    "full-community-application",
    {},
    { timeout: 15_000 },
  );
  await waitFor(
    () =>
      expect(application).toHaveAttribute("data-community-status", "connected"),
    { timeout: 15_000 },
  );
  const navigation = canvas.getByRole("navigation", {
    name: "Community navigation",
  });
  await userEvent.click(
    await within(navigation).findByRole(
      "button",
      { name: "support", exact: true },
      { timeout: 15_000 },
    ),
  );
  await waitFor(() =>
    expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
      "#/forums/support",
    ),
  );
  await userEvent.click(
    within(navigation).getByRole("button", { name: "general", exact: true }),
  );
  await waitFor(() =>
    expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
      "#/channels/general",
    ),
  );
  await fireEvent.click(
    (await canvas.findAllByRole("button", { name: "Reply in thread" }))[0]!,
  );
  await waitFor(() =>
    expect(canvasElement.ownerDocument.defaultView?.location.hash).toMatch(
      /^#\/channels\/general\/[a-f0-9]{64}$/u,
    ),
  );
}

export async function playRepositoryLogCopyLink({
  canvas,
  canvasElement,
}: {
  canvas: StoryCanvas;
  canvasElement: HTMLElement;
}): Promise<void> {
  const application = await canvas.findByTestId(
    "full-community-application",
    {},
    { timeout: 15_000 },
  );
  await waitFor(
    () =>
      expect(application).toHaveAttribute("data-community-status", "connected"),
    { timeout: 15_000 },
  );
  await expect(
    await canvas.findByRole("heading", { name: "Projects Activity" }),
  ).toBeVisible();
  const repositoriesTab = canvas.getByRole("tab", { name: "Repositories" });
  await waitFor(
    () =>
      expect(getComputedStyle(repositoriesTab).pointerEvents).not.toBe("none"),
    { timeout: 15_000 },
  );
  await userEvent.click(repositoriesTab);
  await userEvent.click(
    await canvas.findByRole("button", {
      name: /community-client Hosted browser and desktop client/u,
    }),
  );
  await userEvent.click(await canvas.findByRole("tab", { name: "Log" }));
  await waitFor(() =>
    expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
      projectRouteToHash({
        kind: "repository",
        coordinate: projectStoryRepositoryCoordinate,
        surface: "log",
      }),
    ),
  );
  const copied: string[] = [];
  Object.defineProperty(
    canvasElement.ownerDocument.defaultView!.navigator,
    "clipboard",
    {
      configurable: true,
      value: { writeText: async (value: string) => copied.push(value) },
    },
  );
  await userEvent.click(
    canvas.getByRole("button", { name: "Log link copied" }),
  );
  await expect(copied[0]).toMatch(/^lapis-community:\/\/repo\?/u);
  await expect(copied[0]).toContain("tab=log");
  await userEvent.click(canvas.getByRole("button", { name: "Op Log" }));
  await waitFor(() =>
    expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
      projectRouteToHash({
        kind: "repository",
        coordinate: projectStoryRepositoryCoordinate,
        surface: "oplog",
      }),
    ),
  );
  await userEvent.click(
    canvas.getByRole("button", { name: "Op Log link copied" }),
  );
  await expect(copied[1]).toContain("tab=oplog");
}
