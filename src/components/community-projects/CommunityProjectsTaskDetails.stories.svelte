<script lang="ts">
  import { provideCommunityShareLink } from "../community-entity-chip/share-link.js";

  provideCommunityShareLink({
    href: () => undefined,
    copy: () => {},
  });
</script>

<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import CommunityProjectsTaskDetails from "./CommunityProjectsTaskDetails.svelte";

  const owner = "a".repeat(64);
  const id = "b".repeat(64);

  const { Story } = defineMeta({
    title: "Community/Projects/Task details",
    component: CommunityProjectsTaskDetails,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Open task"
  args={{
    task: {
      lifecycle: "open",
      assignees: [],
      activity: [
        { assignment: "assign", event: { content: "" } },
        { event: { content: "Noted" } },
      ],
      repository: { coordinate: `30617:${owner}:lapis-community` },
      root: { id },
    },
  }}
  play={async ({ canvas }) => {
    for (const name of [/^Status/u, /^Assignees/u, /^Comments/u]) {
      const button = canvas.getByRole("button", { name });
      await expect(button).not.toHaveAttribute("data-active");
      await expect(button).not.toHaveAttribute("aria-current");
    }
    await expect(canvas.getByRole("button", { name: /^Comments/u })).toHaveTextContent(
      "1",
    );
    const comments = canvas.getByRole("button", { name: /^Comments/u });
    const copyLink = canvas.getByRole("button", { name: "Copy Link" });
    await expect(copyLink).toBeVisible();
    await expect(
      comments.compareDocumentPosition(copyLink) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsTaskDetails {...args} />
  {/snippet}
</Story>
