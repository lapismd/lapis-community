<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityProjectsActivityFeed from "./CommunityProjectsActivityFeed.svelte";
  import {
    repositoryContextEvents,
    contextFixture as f,
  } from "../../testing/repository-context-fixture.js";
  import { withRepositoryContextActivity } from "../../projects/repository-context-activity.js";
  import { createBrowserProjectActivityFilterStore } from "../../projects/activity-filters.js";
  import "./CommunityProjects.css";
  const { Story } = defineMeta({
    title: "Community/Projects/Activity Context",
    component: CommunityProjectsActivityFeed,
    tags: ["visual-pending"],
    args: {
      projectName: () => "Notes",
      onOpenProject: fn(),
      onOpenItem: fn(),
      filterStore: createBrowserProjectActivityFilterStore({
        storage: {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
      }),
    },
  });
</script>

<Story
  name="Agent conversation and checkpoint"
  args={{
    activity: withRepositoryContextActivity([], repositoryContextEvents()).map(
      (item) => ({
        ...item,
        agentContext: item.agentContext?.map((checkpoint) => ({
          ...checkpoint,
          commitIds: [...checkpoint.commitIds, ...checkpoint.commitIds],
        })),
      }),
    ),
  }}
  play={async ({ canvas }) => {
    const disclosure = await canvas.findByRole("button", {
      name: "Agent context",
      exact: true,
    });
    const header = disclosure.parentElement!;
    const menuTrigger = canvas.getByRole("button", {
      name: "Agent context references",
    });
    await userEvent.click(menuTrigger);
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Escape}");
    const row = disclosure.closest("article")!;
    const pointer =
      import.meta.env.MODE === "test"
        ? (await import("vitest/browser")).userEvent
        : undefined;
    if (pointer)
      await pointer.hover(
        canvas.getByRole("heading", { name: "Projects Activity" }),
      );
    if (pointer)
      await expect(
        row.matches(":hover"),
        "pointer leaves the activity row",
      ).toBe(false);
    const closedBackground = getComputedStyle(header).backgroundColor;
    let hoverBackground: string | undefined;
    if (pointer) {
      await pointer.hover(row);
      hoverBackground = getComputedStyle(header).backgroundColor;
      await expect(hoverBackground, "row hover darkens the header").not.toBe(
        closedBackground,
      );
      await pointer.hover(disclosure);
      await expect(getComputedStyle(header).backgroundColor).toBe(
        hoverBackground,
      );
    }
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await expect(
      canvas.queryByText("Updated the README and verified the diff."),
    ).not.toBeInTheDocument();
    disclosure.focus();
    await userEvent.keyboard("{Enter}");
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    await expect(getComputedStyle(header).backgroundColor).not.toBe(
      closedBackground,
    );
    if (hoverBackground)
      await expect(getComputedStyle(header).backgroundColor).toBe(
        hoverBackground,
      );
    await expect(getComputedStyle(header).backgroundColor).not.toBe(
      getComputedStyle(row).backgroundColor,
    );
    await expect(
      canvas.getByText("Updated the README and verified the diff."),
    ).toBeVisible();
    await expect(
      canvas.getByText("apply_patch", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "bbbbbbbbbbbb" }),
    ).toBeVisible();
    const agentAvatar = canvas
      .getByLabelText("Message from Nyra")
      .querySelector('[data-ui-component="community-member-avatar"]');
    await expect(agentAvatar).toHaveAttribute("data-shape", "rounded");
    if (pointer)
      await pointer.hover(
        canvas.getByRole("heading", { name: "Projects Activity" }),
      );
    if (hoverBackground)
      await expect(getComputedStyle(header).backgroundColor).toBe(
        hoverBackground,
      );
    await userEvent.click(disclosure);
    if (pointer)
      await pointer.hover(
        canvas.getByRole("heading", { name: "Projects Activity" }),
      );
    await expect(getComputedStyle(header).backgroundColor).toBe(
      closedBackground,
    );
    await expect(
      canvas.queryByText("Updated the README and verified the diff."),
    ).not.toBeInTheDocument();
  }}
/>

<Story
  name="Checkpoint Log link from projects Activity"
  args={{
    filterPage: "projects",
    activity: withRepositoryContextActivity([], repositoryContextEvents()),
  }}
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Agent context references" }),
    );
    const menu = within(
      await within(canvasElement.ownerDocument.body).findByRole("menu"),
    );
    const log = menu.getAllByRole("menuitem").at(-1)!;
    await expect(log).toHaveTextContent(/^Log$/);
    await expect(log).toHaveAttribute(
      "href",
      `#/projects/repository/${f.repository}/log/${f.commit}`,
    );
    await userEvent.keyboard("{Escape}");
  }}
/>

<Story
  name="Checkpoint Log link from project Activity"
  args={{
    filterPage: "project",
    activity: withRepositoryContextActivity([], repositoryContextEvents()),
  }}
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Agent context references" }),
    );
    const menu = within(
      await within(canvasElement.ownerDocument.body).findByRole("menu"),
    );
    const log = menu.getAllByRole("menuitem").at(-1)!;
    await expect(log).toHaveTextContent(/^Log$/);
    await expect(log).toHaveAttribute(
      "href",
      `#/projects/repository/${f.repository}/log/${f.commit}`,
    );
    await userEvent.keyboard("{Escape}");
  }}
/>

<Story
  name="Checkpoint Log link from repositories Activity"
  args={{
    filterPage: "repositories",
    activity: withRepositoryContextActivity([], repositoryContextEvents()),
  }}
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Agent context references" }),
    );
    const menu = within(
      await within(canvasElement.ownerDocument.body).findByRole("menu"),
    );
    const log = menu.getAllByRole("menuitem").at(-1)!;
    await expect(log).toHaveTextContent(/^Log$/);
    await expect(log).toHaveAttribute(
      "href",
      `#/projects/repository/${f.repository}/log/${f.commit}`,
    );
    await userEvent.keyboard("{Escape}");
  }}
/>
