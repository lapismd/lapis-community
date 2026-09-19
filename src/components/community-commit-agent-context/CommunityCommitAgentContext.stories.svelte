<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityCommitAgentContext from "./CommunityCommitAgentContext.svelte";
  import {
    contextFixture,
    repositoryContextEvents,
  } from "../../testing/repository-context-fixture.js";
  const { Story } = defineMeta({
    title: "Community/Projects/Commit Agent Context",
    component: CommunityCommitAgentContext,
    tags: ["visual-pending"],
    args: {
      events: repositoryContextEvents(),
      commitId: contextFixture.commit,
      repositoryAddress: contextFixture.repository,
    },
    parameters: {
      docs: {
        source: {
          code: "<CommunityCommitAgentContext {events} commitId={commit.sha} {members} {repositoryAddress} />",
        },
      },
    },
  });
</script>

<Story
  name="Collapsed conversation"
  play={async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: /Agent context/ });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(
      canvas.queryByText("Updated the README and verified the diff."),
    ).not.toBeVisible();
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByText("Updated the README and verified the diff."),
    ).toBeVisible();
    await expect(
      canvas.getByText("apply_patch", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: contextFixture.commit.slice(0, 12) }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining(`/commits/${contextFixture.commit}`),
    );
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }}
/>

<Story
  name="Missing pages"
  args={{ events: repositoryContextEvents().slice(1) }}
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /Agent context/ }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Some agent context is unavailable",
    );
  }}
/>

<Story
  name="Unrelated commit"
  args={{ commitId: "e".repeat(40) }}
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByRole("button", { name: /Agent context/ }),
    ).not.toBeInTheDocument();
  }}
/>
