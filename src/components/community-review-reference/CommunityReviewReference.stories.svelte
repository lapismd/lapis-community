<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";
  import CommunityReviewReference from "./CommunityReviewReference.svelte";
  import {
    checkpoint,
    request,
    commit,
    signOwner,
  } from "../../testing/agent-conversation-fixture.js";
  import { createCommitComment } from "../../projects/commit-comments.js";
  const comment = signOwner(
    createCommitComment(checkpoint, commit, request.id, "Review this change"),
  );
  const description =
    "docs: explain how sanitized discussion context follows a repository change\n\nPreserve the full description in the tooltip.";
  const { Story } = defineMeta({
    title: "Community/Projects/Review Reference",
    component: CommunityReviewReference,
    tags: ["visual-pending"],
    args: { comment, description },
    parameters: {
      docs: {
        source: {
          code: "<CommunityReviewReference {comment} description={commitDescription} />",
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Commit subject with full description"
  play={async ({ canvas }) => {
    const link = canvas.getByRole("link", {
      name: `Commit: ${description.split("\n")[0]}`,
    });
    await expect(link).toHaveAttribute("data-chip-shape", "square");
    await expect(link.querySelector("svg")).not.toBeNull();
    await userEvent.hover(link);
    link.focus();
    await expect(link).toHaveFocus();
    await waitFor(() =>
      expect(link).not.toHaveAttribute("data-state", "closed"),
    );
    let tooltip: HTMLElement | null = null;
    await waitFor(() => {
      const descriptionId = link.getAttribute("aria-describedby");
      expect(descriptionId).toBeTruthy();
      tooltip =
        link.ownerDocument.getElementById(descriptionId!) ??
        document.getElementById(descriptionId!);
      expect(tooltip).not.toBeNull();
    });
    await expect(tooltip).toHaveTextContent(
      "Preserve the full description in the tooltip.",
    );
    await expect(link).toHaveAttribute(
      "href",
      expect.stringContaining(`/commits/${commit}`),
    );
  }}
/>
<Story
  name="Filename and line"
  args={{
    comment: {
      ...comment,
      tags: [...comment.tags, ["file", "docs/README.md"], ["line", "31"]],
    },
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "Comment on docs/README.md:31" }),
    ).toHaveTextContent("README.md:31");
    await expect(
      canvas.queryByText(commit.slice(0, 12)),
    ).not.toBeInTheDocument();
  }}
/>
