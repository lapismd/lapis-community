<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

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
  play={async ({ canvas }) => {
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
        name: "Start a new post in support-ai",
      }),
    );
    await expect(
      canvas.getByRole("combobox", { name: "Message" }),
    ).toBeVisible();
  }}
/>
