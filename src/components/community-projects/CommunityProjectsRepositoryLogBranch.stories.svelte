<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import Harness from "./CommunityProjectsRepositoryLogBranchHarness.svelte";
  import {
    events,
    merge,
    operation,
    parent,
  } from "./repository-log-story-fixtures.js";

  const longRevisionTitle = `jj-sync carrier ${operation.slice(0, 64)} published a branch projection with enough descriptive text to collide with copy controls unless the title truncates`;
  const longTitleEvents = events.map((event) => {
    const body = JSON.parse(event.content);
    return body.commit_id === merge
      ? {
          ...event,
          content: JSON.stringify({ ...body, description: longRevisionTitle }),
        }
      : event;
  });

  const branches = [
    { name: "main", sha: parent },
    { name: "community-visible", sha: merge },
    { name: "jj-sync/scope/replica", sha: "9".repeat(40) },
    { name: "empty-projection", sha: "8".repeat(40) },
  ];

  const { Story } = defineMeta({
    title: "Community/Projects/Repository Log Branch",
    component: Harness,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityProjects view="log" repositoryBranches={branches} selectedRepositoryBranch="community-visible" />`,
        },
      },
    },
    args: {
      events: longTitleEvents,
      branch: "community-visible",
      branches,
    },
  });
</script>

<Story
  name="Branch selector updates immediately"
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const selector = await canvas.findByRole("combobox", {
      name: "Repository branch",
    });
    await expect(selector).toHaveTextContent("community-visible");

    const longLink = await canvas.findByRole("link", {
      name: longRevisionTitle,
    });
    const longStyle = getComputedStyle(longLink);
    await expect(longStyle.overflow).toBe("hidden");
    await expect(longStyle.textOverflow).toBe("ellipsis");
    const ids = longLink
      .closest("li")
      ?.querySelector(".community-revision-graph-ids");
    if (!(ids instanceof HTMLElement))
      throw new Error("Expected copy controls");
    await expect(longLink.getBoundingClientRect().right).toBeLessThanOrEqual(
      ids.getBoundingClientRect().left,
    );

    await userEvent.click(selector);
    await userEvent.click(page.getByRole("option", { name: /main/ }));
    await expect(selector).toHaveTextContent("main");
    await waitFor(() => {
      expect(
        canvas.queryByRole("link", { name: longRevisionTitle }),
      ).toBeNull();
      expect(
        canvas
          .getByRole("list", { name: "Revision graph" })
          .querySelectorAll("[data-revision-id]").length,
      ).toBe(1);
    });
    await expect(
      canvas.getByText("(empty) (no description set)"),
    ).toBeVisible();
  }}
/>

<Story
  name="Branch change loading skeleton"
  args={{ loading: true }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const selector = await canvas.findByRole("combobox", {
      name: "Repository branch",
    });
    await userEvent.click(selector);
    await userEvent.click(page.getByRole("option", { name: /main/ }));
    await expect(selector).toHaveTextContent("main");
    await expect(
      canvas.getByText("Loading repository log branch"),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("list", { name: "Revision graph" }),
    ).toBeNull();
  }}
/>

<Story
  name="Sync branch keeps current projection"
  args={{ branch: "jj-sync/scope/replica" }}
  play={async ({ canvas }) => {
    const selector = await canvas.findByRole("combobox", {
      name: "Repository branch",
    });
    await expect(selector).toHaveTextContent("jj-sync/scope/replica");
    await expect(
      canvas.getByRole("list", { name: "Revision graph" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: longRevisionTitle }),
    ).toBeVisible();
  }}
/>

<Story
  name="Empty branch keeps log shell"
  args={{ branch: "empty-projection" }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const selector = await canvas.findByRole("combobox", {
      name: "Repository branch",
    });
    await expect(selector).toHaveTextContent("empty-projection");
    await expect(
      canvas.getByText("No projection for this branch yet"),
    ).toBeVisible();
    await userEvent.click(selector);
    await userEvent.click(
      page.getByRole("option", { name: /community-visible/ }),
    );
    await expect(selector).toHaveTextContent("community-visible");
    await expect(
      canvas.getByRole("list", { name: "Revision graph" }),
    ).toBeVisible();
  }}
/>
