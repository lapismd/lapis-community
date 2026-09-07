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
    onOpenProfile: fn(),
    onMessageMember: fn(),
    onWaveMember: fn(),
    onCreateTopic: fn(async () => {}),
  }}
  play={async ({ args, canvas, canvasElement }) => {
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
    const topicRow = topic.closest<HTMLElement>(".forum-topic-list__topic-row");
    await expect(topicRow).not.toBeNull();
    const recentParticipants = topicRow?.querySelector<HTMLElement>(
      '[data-ui-part="forum-topic-participants"]',
    );
    await expect(recentParticipants).not.toBeNull();
    await expect(recentParticipants).toHaveAttribute(
      "title",
      "Recent participants: Noor Rahman, Cy Park, Ben Stone",
    );
    await expect(recentParticipants?.children).toHaveLength(3);
    await expect(within(topicRow!).getByText("12m")).toBeVisible();
    await expect(getComputedStyle(topicRow!).borderBottomLeftRadius).toBe(
      "0px",
    );
    await expect(getComputedStyle(topicRow!).borderBottomRightRadius).toBe(
      "0px",
    );

    const author = within(topicRow!).getByRole("button", {
      name: "Ada Lovelace",
    });
    await userEvent.hover(author);
    const contactPreview = await within(
      canvasElement.ownerDocument.body,
    ).findByRole("group", { name: "Ada Lovelace contact preview" });
    await expect(contactPreview).toBeVisible();
    await expect(
      within(contactPreview).getByRole("button", {
        name: "Message Ada Lovelace",
      }),
    ).toBeVisible();
    await expect(
      within(contactPreview).getByRole("button", {
        name: "Wave to Ada Lovelace",
      }),
    ).toBeVisible();
    await userEvent.click(
      within(contactPreview).getByRole("button", {
        name: "Open Ada Lovelace's profile",
      }),
    );
    await expect(args.onOpenProfile).toHaveBeenCalledWith(
      communityStoryMembers[0],
    );
    await expect(args.onOpenTopic).not.toHaveBeenCalled();
    await userEvent.click(topic);
    await expect(args.onOpenTopic).toHaveBeenCalledWith("topic-large-vault");

    const replyHeading = canvas.getByText("Replies");
    const replyCount = within(topicRow!).getByText("34");
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
    const unreadTopicRow = unreadTopic.closest<HTMLElement>(
      ".forum-topic-list__topic-row",
    );
    await expect(unreadTopicRow).not.toBeNull();
    const unreadMarker = within(unreadTopicRow!).getByRole("img", {
      name: "Unread topic",
    });
    const unreadTitle = within(unreadTopicRow!).getByText(
      "First-token latency with a large vault",
    );
    const unreadExcerpt = within(unreadTopicRow!).getByText(
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
