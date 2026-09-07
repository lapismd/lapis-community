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
    await expect(getComputedStyle(topic).borderBottomLeftRadius).toBe("0px");
    await expect(getComputedStyle(topic).borderBottomRightRadius).toBe("0px");

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
  name="No active topics"
  args={{
    title: "support-ai",
    description: "Questions, guides, and support for the AI plugin",
    topics: [],
    members: communityStoryMembers,
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "No active topics in support-ai" }),
    ).toBeVisible();
    await expect(
      canvas.getByText("Questions, guides, and support for the AI plugin"),
    ).toBeVisible();
    await expect(canvas.queryByText("Replies")).not.toBeInTheDocument();
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

<Story
  name="Partial reply counts"
  args={{
    title: "support-ai",
    topics: communityStoryTopics,
    members: communityStoryMembers,
    historyUpdating: true,
    onOpenTopic: fn(),
    onCreateTopic: fn(async () => {}),
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByLabelText("34 or more replies; older history is updating"),
    ).toHaveTextContent("34+");
  }}
/>

<Story
  name="Embedded topic states"
  args={{
    title: "New & Unread",
    topics: [
      {
        ...communityStoryTopics[0]!,
        pinned: false,
        unread: true,
        replyCountApproximate: true,
      },
      {
        ...communityStoryTopics[1]!,
        isNew: true,
        replyCountAvailable: false,
      },
    ],
    members: communityStoryMembers,
    onOpenTopic: fn(),
    embedded: true,
    showTopicActions: false,
  }}
  play={async ({ canvas }) => {
    const unreadTopic = canvas.getByRole("button", {
      name: "Open unread topic First-token latency with a large vault",
    });
    const unreadMarker = within(unreadTopic).getByRole("img", {
      name: "Unread topic",
    });
    const unreadTitle = within(unreadTopic).getByText(
      "First-token latency with a large vault",
    );
    const unreadExcerpt = within(unreadTopic).getByText(
      communityStoryTopics[0]!.excerpt,
    );
    await expect(unreadMarker).toBeVisible();
    await expect(getComputedStyle(unreadMarker).position).toBe("absolute");
    await expect(
      Math.abs(
        unreadTitle.getBoundingClientRect().left -
          unreadExcerpt.getBoundingClientRect().left,
      ),
    ).toBeLessThanOrEqual(1);
    await expect(canvas.queryByText("Unread")).not.toBeInTheDocument();
    await expect(canvas.getByText("New")).toBeVisible();
    await expect(
      canvas.getByLabelText("Approximately 34 replies"),
    ).toHaveTextContent("~34");
    await expect(
      canvas.getByLabelText("Reply count unavailable"),
    ).toHaveTextContent("—");
    await expect(
      canvas.queryByRole("button", { name: / menu$/u }),
    ).not.toBeInTheDocument();
  }}
/>
