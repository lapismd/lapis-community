<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import type { ProjectForgeActivityItem } from "../../projects/model.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsActivityFeed from "./CommunityProjectsActivityFeed.svelte";
  import "./CommunityProjects.css";

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
      weekActivityDigest: "2 events this week.",
      weekActivityCount: 2,
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
