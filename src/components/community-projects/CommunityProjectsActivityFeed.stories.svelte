<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

  import type { ProjectForgeActivityItem } from "../../projects/model.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsActivityFeed from "./CommunityProjectsActivityFeed.svelte";
  import "./CommunityProjects.css";

  const owner = "1".repeat(64);
  const projectCoordinate = `30617:${owner}:notes`;
  const sha = "a".repeat(40);
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
      title: "4cdef4cd",
      body: "replica-desktop",
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
  play={async ({ canvas, canvasElement }) => {
    const copy = canvas.getByRole("button", {
      name: `Copy full commit ID: ${sha}`,
    });
    await expect(copy).toBeVisible();
    await expect(canvas.queryByText(sha.slice(0, 10))).toBeNull();
    const sync = canvas.getByText("jj-sync");
    await expect(sync).toHaveAttribute("data-chip-shape", "square");
    await expect(sync).toHaveAttribute("data-chip-variant", "muted");
    await expect(sync.querySelector(".lucide-refresh-cw")).not.toBeNull();
  }}
/>
