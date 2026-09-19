<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import {
    createBrowserProjectActivityFilterStore,
    projectActivityFilterStorageKey,
  } from "../../projects/activity-filters.js";
  import type { ProjectForgeActivityItem } from "../../projects/model.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsActivityFeed from "./CommunityProjectsActivityFeed.svelte";
  import "./CommunityProjects.css";

  import { repositoryContextEvents } from "../../testing/repository-context-fixture.js";
  import { withRepositoryContextActivity } from "../../projects/repository-context-activity.js";

  const owner = "1".repeat(64);
  const projectCoordinate = `30617:${owner}:notes`;
  const sha = "a".repeat(40);
  const operationId = "4cdef".repeat(16);
  const replicaId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const member: CommunityMemberModel = {
    id: owner,
    name: "Maya Chen",
    handle: "@maya",
    initials: "MC",
  };
  const persisted = new Map<string, string>();
  const activity: ProjectForgeActivityItem[] = [
    {
      id: `commit:${projectCoordinate}:${sha}`,
      kind: "commit",
      createdAt: 1_700_000_000,
      actorPubkey: owner,
      action: "pushed a commit to",
      title: "Stay on dest main",
      body: "",
      detail: sha,
      projectCoordinate,
    },
    {
      id: `jj-sync:${"4".repeat(64)}`,
      kind: "commit",
      createdAt: 1_699_000_000,
      actorPubkey: owner,
      action: "published a jj-sync operation in",
      title: operationId,
      body: replicaId,
      detail: "jj-sync",
      projectCoordinate,
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Projects/Activity Feed",
    component: CommunityProjectsActivityFeed,
    tags: ["visual-pending"],
    args: {
      activity,
      filterStore: createBrowserProjectActivityFilterStore({
        storage: {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
      }),
      members: [member],
      projectName: () => "Notes",
      onOpenProject: fn(),
      onOpenItem: fn(),
    },
  });
</script>

<Story
  name="Hash copy and jj-sync chip"
  play={async ({ canvas }) => {
    const copy = canvas.getByRole("button", {
      name: `Copy full commit ID: ${sha}`,
    });
    await expect(copy).toBeVisible();
    await expect(canvas.queryByText(sha.slice(0, 10))).toBeNull();
    const operation = canvas.getByRole("button", {
      name: `Copy full operation ID: ${operationId}`,
    });
    const replica = canvas.getByRole("button", {
      name: `Copy full replica ID: ${replicaId}`,
    });
    await expect(operation).toBeVisible();
    await expect(replica).toBeVisible();
    await expect(operation.closest("button")).toBe(operation);
    const operationBox = operation.getBoundingClientRect();
    const replicaBox = replica.getBoundingClientRect();
    await expect(replicaBox.left).toBeGreaterThan(operationBox.right);
    await expect(replicaBox.top).toBeCloseTo(operationBox.top, 0);
    const title = operation.closest(
      ".community-projects__activity-title",
    ) as HTMLElement;
    const icon = title.querySelector(":scope > svg") as SVGElement;
    const midpoint = (box: DOMRect) => box.top + box.height / 2;
    await expect(
      Math.abs(midpoint(icon.getBoundingClientRect()) - midpoint(operationBox)),
    ).toBeLessThan(2);
    const group = operation.closest(
      ".community-projects__activity-copy-ids",
    ) as HTMLElement;
    group.style.maxWidth = "7rem";
    const wrappedOperation = operation.getBoundingClientRect();
    const wrappedReplica = replica.getBoundingClientRect();
    await expect(wrappedReplica.top).toBeGreaterThan(wrappedOperation.bottom);
    const sync = canvas.getByText("jj-sync");
    await expect(sync).toHaveAttribute("data-chip-shape", "square");
    await expect(sync).toHaveAttribute("data-chip-variant", "muted");
    await expect(sync.querySelector(".lucide-refresh-cw")).not.toBeNull();
    const row = sync.closest(".community-projects__activity-item");
    await userEvent.hover(row as HTMLElement);
    await expect(getComputedStyle(sync).backgroundColor).toBe(
      getComputedStyle(copy).backgroundColor,
    );
    await expect(getComputedStyle(sync).backgroundColor).not.toBe(
      getComputedStyle(row as HTMLElement).backgroundColor,
    );
  }}
/>

<Story
  name="Filters relay event types"
  args={{
    activity: [
      ...activity,
      {
        id: "task:1",
        kind: "task",
        createdAt: 1_700_000_100,
        actorPubkey: owner,
        action: "created a task in",
        title: "Ship the filter",
        body: "",
        projectCoordinate,
      },
    ],
    filterStore: createBrowserProjectActivityFilterStore({
      storage: {
        getItem: () => null,
        setItem: (key, value) => persisted.set(key, value),
        removeItem: (key) => persisted.delete(key),
      },
    }),
    members: [member],
    projectName: () => "Notes",
    onOpenProject: fn(),
    onOpenItem: fn(),
  }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText("Ship the filter")).toBeVisible();
    await expect(canvas.getByText("Stay on dest main")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Filter activity" }),
    );
    const trigger = canvas.getByRole("button", { name: "Filter activity" });
    await expect(trigger).toHaveAttribute("data-variant", "ghost");
    await userEvent.click(
      page.getByRole("option", { name: /Tasks Kind 1621/u }),
    );
    await expect(canvas.getByText("Ship the filter")).toBeVisible();
    await expect(canvas.queryByText("Stay on dest main")).toBeNull();
    await userEvent.click(page.getByRole("option", { name: /Commits/u }));
    await expect(canvas.getByText("Ship the filter")).toBeVisible();
    await expect(canvas.getByText("Stay on dest main")).toBeVisible();
    await expect(trigger).toHaveAttribute("data-variant", "default");
    await expect(
      persisted.get(projectActivityFilterStorageKey("projects")),
    ).toContain("task");
    await expect(
      persisted.get(projectActivityFilterStorageKey("projects")),
    ).toContain("commit");
  }}
/>

<Story
  name="Agent conversation and checkpoint"
  args={{
    activity: withRepositoryContextActivity([], repositoryContextEvents()),
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("Updated the README and verified the diff."),
    ).toBeVisible();
    await expect(
      canvas.getByText("apply_patch", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "bbbbbbbbbbbb" }),
    ).toBeVisible();
  }}
/>
