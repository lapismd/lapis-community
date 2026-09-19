<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";
  import CommunityCommitSummary from "./CommunityCommitSummary.svelte";
  const { Story } = defineMeta({
    title: "Community/Projects/Commit Summary",
    component: CommunityCommitSummary,
    tags: ["visual-pending"],
    args: {
      commit: {
        sha: "b".repeat(40),
        subject: "Document agent checkpoints",
        author_date: "2026-09-19T12:00:00Z",
      },
      authorName: "Nyra",
      additions: 3,
      deletions: 0,
      onCopy: fn(),
      onClose: fn(),
    },
  });
</script>

<Story
  name="Agent author"
  play={async ({ canvas, args }) => {
    await expect(
      canvas.getByRole("heading", { name: "Document agent checkpoints" }),
    ).toBeVisible();
    await expect(canvas.getByText("Nyra")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Copy commit bbbbbbb" }),
    );
    await expect(args.onCopy).toHaveBeenCalledWith("b".repeat(40));
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to commits" }),
    );
    await expect(args.onClose).toHaveBeenCalled();
  }}
/>
