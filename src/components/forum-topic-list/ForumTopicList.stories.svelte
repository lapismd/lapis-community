<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryTopics,
  } from "../community-workspace/story-fixtures.js";
  import ForumTopicList from "./ForumTopicList.svelte";

  const { Story } = defineMeta({
    title: "Community/Forums/Topic List",
    component: ForumTopicList,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Active support topics"
  args={{
    title: "support-ai",
    description: "Questions, guides, and support for the AI plugin",
    topics: communityStoryTopics,
    members: communityStoryMembers,
    onOpenTopic: fn(),
    onCreateTopic: fn(async () => {}),
  }}
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("region", { name: "support-ai topics" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "support-ai" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("Questions, guides, and support for the AI plugin"),
    ).not.toBeInTheDocument();
    const topic = canvas.getByRole("button", {
      name: "Open topic First-token latency with a large vault",
    });
    const recentParticipants = topic.querySelector<HTMLElement>(
      '[data-ui-part="forum-topic-participants"]',
    );
    await expect(recentParticipants).not.toBeNull();
    await expect(recentParticipants).toHaveAttribute(
      "title",
      "Recent participants: Noor Rahman, Cy Park, Ben Stone",
    );
    await expect(recentParticipants?.children).toHaveLength(3);
    await expect(within(topic).getByText("12m")).toBeVisible();

    const replyHeading = canvas.getByText("Replies");
    const replyCount = within(topic).getByText("34");
    const headingCenter =
      replyHeading.getBoundingClientRect().left +
      replyHeading.getBoundingClientRect().width / 2;
    const countCenter =
      replyCount.getBoundingClientRect().left +
      replyCount.getBoundingClientRect().width / 2;
    await expect(Math.abs(headingCenter - countCenter)).toBeLessThanOrEqual(1);
    await expect(canvas.getByText("Aug 2025")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Open First-token latency with a large vault menu",
      }),
    );
    const menu = within(canvasElement.ownerDocument.body).getByRole("menu");
    await expect(
      menu.querySelector('[data-ui-part$="-separator"]:last-child'),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Start a new post in support-ai",
      }),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Read-only composer warning"
  args={{
    title: "support-ai",
    topics: communityStoryTopics,
    members: communityStoryMembers,
    onCreateTopic: fn(async () => {}),
    disabled: true,
    readOnlyReason: "Join this room before posting or reacting",
    composerStatus: {
      type: "warning" as const,
      message: "Join this room before posting or reacting",
    },
  }}
  play={async ({ canvas }) => {
    const warning = canvas.getByRole("status");
    await expect(warning).toHaveTextContent(
      "Join this room before posting or reacting",
    );
    await expect(warning).toHaveAttribute("data-status", "warning");
    await expect(
      warning.closest('[data-ui-component="community-topic-composer"]'),
    ).not.toBeNull();
  }}
/>
