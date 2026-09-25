<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, within, waitFor } from "storybook/test";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";
  import { projectRouteToHash } from "./navigation.js";
  import { projectStoryRepositoryCoordinate } from "../community-projects/story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell/Mobile toolbars",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: { layout: "fullscreen", communityAppShell: true },
  });

  function activeApplicationMain(application: HTMLElement): HTMLElement {
    const main = application.querySelector<HTMLElement>(
      '[data-ui-part="mobile-main-lane"]:not([aria-hidden="true"]) .community-application__main[data-ui-part="main"]',
    );
    if (!main) throw new Error("Expected the active application main surface");
    return main;
  }

  function directMainToolbars(application: HTMLElement): HTMLElement[] {
    return Array.from(activeApplicationMain(application).children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.getAttribute("data-ui-part") === "toolbar",
    );
  }

  function directToolbar(application: HTMLElement, label: string): HTMLElement {
    const matches = directMainToolbars(application).filter(
      (toolbar) => toolbar.getAttribute("aria-label") === label,
    );
    if (matches.length !== 1)
      throw new Error(`Expected one ${label} toolbar; found ${matches.length}`);
    return matches[0]!;
  }

  async function expectSingleToolbar(
    application: HTMLElement,
    toolbar: HTMLElement,
  ): Promise<void> {
    const label = toolbar.getAttribute("aria-label");
    await waitFor(() =>
      expect(
        directMainToolbars(application).map((item) =>
          item.getAttribute("aria-label"),
        ),
      ).toEqual([label]),
    );
  }

  async function expectMobileShell(application: HTMLElement): Promise<void> {
    const shell = application.querySelector<HTMLElement>("[data-shell-root]");
    if (!shell) throw new Error("Expected the responsive App Shell root");
    await waitFor(() => {
      expect(shell).toHaveAttribute("data-display-mode", "mobile");
      expect(shell).toHaveAttribute("data-mobile-stage", "main");
    });
  }

  async function expectNavigation(toolbar: HTMLElement): Promise<void> {
    const buttons = within(toolbar).getAllByRole("button");
    await expect(buttons[0]).toHaveAccessibleName("Open navigation sidebar");
    await expect(buttons[1]).toHaveAccessibleName("Back");
    await expect(buttons[2]).toHaveAccessibleName("Forward");
  }
</script>

<Story
  name="Inbox owns mobile toolbar"
  globals={{ viewport: { value: "tablet", isRotated: false } }}
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId("full-community-application");
    await expectMobileShell(application);
    const toolbar = directToolbar(application, "Inbox page header");
    await expectSingleToolbar(application, toolbar);
    await expectNavigation(toolbar);
    await expect(toolbar).toHaveTextContent("Inbox");
    await expect(
      within(toolbar).queryByRole("button", { name: "Inbox options" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="inbox-mobile-toolbar"
      responsive
      initialDestination="inbox"
    />
  {/snippet}
</Story>

<Story
  name="Projects owns mobile toolbar"
  globals={{ viewport: { value: "tablet", isRotated: false } }}
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId("full-community-application");
    await expectMobileShell(application);
    const toolbar = directToolbar(application, "Project sections");
    await expectSingleToolbar(application, toolbar);
    await expectNavigation(toolbar);
    const scoped = within(toolbar);
    await expect(
      scoped.queryByLabelText("Application navigation"),
    ).not.toBeInTheDocument();
    await expect(
      scoped.getByRole("tab", { name: "Activity" }),
    ).toHaveTextContent("Activity");
    await expect(
      scoped.getByRole("button", { name: "Open project overview sidebar" }),
    ).toHaveAccessibleName("Open project overview sidebar");
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="projects-mobile-toolbar"
      projects
      responsive
      initialDestination="projects"
      initialHash={projectRouteToHash({
        kind: "repository",
        coordinate: projectStoryRepositoryCoordinate,
        surface: "files",
      })}
    />
  {/snippet}
</Story>

<Story
  name="Pulse owns mobile toolbar"
  globals={{ viewport: { value: "tablet", isRotated: false } }}
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId("full-community-application");
    await expectMobileShell(application);
    const toolbar = directToolbar(application, "Pulse page header");
    await expectSingleToolbar(application, toolbar);
    await expectNavigation(toolbar);
    await expect(toolbar).toHaveTextContent("Pulse");
    await expect(
      within(toolbar).queryByRole("tab", { name: "Everyone" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="pulse-mobile-toolbar"
      responsive
      initialDestination="pulse"
      pulseFixtures
    />
  {/snippet}
</Story>
