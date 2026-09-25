import { expect, userEvent, waitFor, within } from "storybook/test";

const projectSheetLayerSelector =
  '.community-application__project-sheet-layer[data-ui-part="surface-layer"]';

export async function closeProjectSurfaceInStory(
  application: HTMLElement,
): Promise<void> {
  await expect(application).not.toHaveAttribute(
    "data-last-action",
    "closed-project-surface",
  );
  await userEvent.click(
    await within(application).findByRole("button", {
      name: "Close project surface",
    }),
  );
  await waitFor(() =>
    expect(application).toHaveAttribute(
      "data-last-action",
      "closed-project-surface",
    ),
  );
  await waitFor(() =>
    expect(
      application.querySelector(projectSheetLayerSelector),
    ).not.toBeInTheDocument(),
  );
}
