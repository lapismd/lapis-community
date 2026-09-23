<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import CommunityProjectsReviewDetails from "./CommunityProjectsReviewDetails.svelte";

  const owner = "a".repeat(64);
  const id = "b".repeat(64);

  const { Story } = defineMeta({
    title: "Community/Projects/Review details",
    component: CommunityProjectsReviewDetails,
    tags: ["visual-pending"],
  });
</script>

<script lang="ts">
  import { provideCommunityShareLink } from "../community-entity-chip/share-link.js";

  provideCommunityShareLink({
    href: () => undefined,
    copy: () => {},
  });
</script>

<Story
  name="Merged review"
  args={{
    pullRequest: {
      lifecycle: "merged",
      branchName: "",
      targetBranch: "default",
      currentCommit: "0e9eac8aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      reviewers: ["reviewer"],
      approvals: [{}],
      repository: { coordinate: `30617:${owner}:lapis-community` },
      root: { id },
    },
  }}
  play={async ({ canvas }) => {
    for (const name of [/^Branch/u, /^Status/u, /^Reviewers/u, /^Approvals/u]) {
      const button = canvas.getByRole("button", { name });
      await expect(button).not.toHaveAttribute("data-active");
      await expect(button).not.toHaveAttribute("aria-current");
    }
    const approvals = canvas.getByRole("button", { name: /^Approvals/u });
    const copyLink = canvas.getByRole("button", { name: "Copy Link" });
    await expect(copyLink).toBeVisible();
    await expect(
      approvals.compareDocumentPosition(copyLink) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsReviewDetails {...args} />
  {/snippet}
</Story>
