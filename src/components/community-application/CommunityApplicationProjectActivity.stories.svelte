<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import CommunityApplicationStoryHarness from "./CommunityApplicationStoryHarness.svelte";
  import { projectRouteToHash } from "./navigation.js";
  import { projectStoryProjectCoordinate } from "../community-projects/story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Examples/Project Activity Navigation",
    component: CommunityApplication,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityApplication } from "@lapismd/lapis-community/components";
<\/script>
<CommunityApplication {controller} {projectDataSource} initialDestination="projects" />`,
        },
      },
    },
  });
</script>

<Story
  name="Project navigation opens Activity"
  play={async ({ canvas, canvasElement }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
    const projectNavigation = canvas.getByRole("navigation", {
      name: "Community navigation",
    });
    await userEvent.click(
      await within(projectNavigation).findByRole("button", {
        name: "Community Client",
      }),
    );
    await expect(
      await canvas.findByRole("region", {
        name: "Community Client project workspace",
      }),
    ).toHaveAttribute("data-view", "activity");
    await expect(canvas.getByRole("tab", { name: "Activity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      canvas.getByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(canvasElement.ownerDocument.defaultView?.location.hash).toBe(
        projectRouteToHash({
          kind: "project",
          coordinate: projectStoryProjectCoordinate,
          surface: "activity",
        }),
      ),
    );
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="project-navigation-activity"
      projects
      initialDestination="projects"
    />
  {/snippet}
</Story>

<Story
  name="Cold direct project Activity"
  play={async ({ canvas }) => {
    const application = await canvas.findByTestId(
      "full-community-application",
      {},
      { timeout: 15_000 },
    );
    await waitFor(
      () =>
        expect(application).toHaveAttribute(
          "data-community-status",
          "connected",
        ),
      { timeout: 15_000 },
    );
    await expect(
      await canvas.findByRole("region", {
        name: "Community Client project workspace",
      }),
    ).toHaveAttribute("data-view", "activity");
    await expect(canvas.getByRole("tab", { name: "Activity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      canvas.getByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Repositories" }));
    await expect(
      await canvas.findByRole("button", {
        name: /^(Mine|Other repositories)$/u,
      }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("region", {
        name: "Community Client project workspace",
      }),
    ).toHaveAttribute("data-view", "repositories");
    let skeletonPainted = false;
    let frame = 0;
    const observeFrame = () => {
      skeletonPainted ||=
        canvas.queryByRole("status", {
          name: "Loading project activity",
        }) !== null;
      frame = requestAnimationFrame(observeFrame);
    };
    frame = requestAnimationFrame(observeFrame);
    try {
      await userEvent.click(canvas.getByRole("tab", { name: "Activity" }));
      await waitFor(() => expect(skeletonPainted).toBe(true));
      await waitFor(() =>
        expect(
          canvas.queryByRole("status", {
            name: "Loading project activity",
          }),
        ).not.toBeInTheDocument(),
      );
    } finally {
      cancelAnimationFrame(frame);
    }
    await expect(
      await canvas.findByRole("heading", { name: "Projects Activity" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("region", {
        name: "Community Client project workspace",
      }),
    ).toHaveAttribute("data-view", "activity");
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="cold-direct-project-activity"
      projects
      initialDestination="registry"
      initialHash={projectRouteToHash({
        kind: "project",
        coordinate: projectStoryProjectCoordinate,
        surface: "activity",
      })}
    />
  {/snippet}
</Story>

<Story
  name="Activity skeleton during connection"
  play={async ({ canvas }) => {
    await canvas.findByTestId("full-community-application");
    await expect(
      await canvas.findByRole("heading", {
        name: "Projects Activity",
      }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("status", {
        name: "Loading project activity",
      }),
    ).toBeVisible();
    await expect(
      canvas.queryByText("No project activity yet."),
    ).not.toBeInTheDocument();
    await waitFor(
      () =>
        expect(
          canvas.queryByRole("status", {
            name: "Loading project activity",
          }),
        ).not.toBeInTheDocument(),
      { timeout: 15_000 },
    );
    await expect(
      canvas.getByRole("region", {
        name: "Community Client project workspace",
      }),
    ).toHaveAttribute("data-view", "activity");
  }}
>
  {#snippet template()}
    <CommunityApplicationStoryHarness
      namespace="project-activity-startup-skeleton"
      projects
      bootstrapDelayMs={2_500}
      initialDestination="projects"
      initialHash={projectRouteToHash({
        kind: "project",
        coordinate: projectStoryProjectCoordinate,
        surface: "activity",
      })}
    />
  {/snippet}
</Story>
