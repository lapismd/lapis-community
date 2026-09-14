<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryMessages,
    communityStoryNavigation,
  } from "../community-workspace/story-fixtures.js";
  import CommunityConversation from "./CommunityConversation.svelte";

  const generalRoom = communityStoryNavigation[0]!.rooms[1]!;
  const groupedMessages = [
    ...communityStoryMessages,
    {
      ...communityStoryMessages.at(-1)!,
      id: "message-docs-follow-up",
      timestamp: "09:39",
      createdAt: "2026-09-02T09:39:00Z",
      content: "I will link the guide from the AI package support forum too.",
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Channels/Conversation",
    component: CommunityConversation,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        description: {
          component:
            "The shared channel, Inbox, and direct-message conversation includes an independent scroll-to-latest recovery control.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let refreshVersion = $state(0);
</script>

<Story
  name="Compact channel feed"
  args={{
    room: generalRoom,
    messages: groupedMessages,
    members: communityStoryMembers,
    onSend: fn(),
    onReply: fn(),
    onOpenThread: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
    onCopyMessageLink: fn(),
    onDeleteMessage: fn(),
    readBoundary: { key: "compact-channel-head", onRead: fn() },
  }}
  play={async ({ canvas, args }) => {
    const list = canvas.getByRole("log", { name: "general messages" });
    const boundary = list.querySelector<HTMLElement>(
      '[data-ui-part="read-boundary"]',
    );
    await expect(boundary).not.toBeNull();
    boundary!.scrollIntoView({ block: "end" });
    await waitFor(() =>
      expect(args.readBoundary!.onRead).toHaveBeenCalledOnce(),
    );
    const inner = list.querySelector<HTMLElement>(
      ':scope > [data-ui-part="list-inner"]',
    );
    const spacer = inner?.querySelector<HTMLElement>(
      ':scope > [data-ui-part="list-spacer"]',
    );
    const firstContent = spacer?.nextElementSibling as HTMLElement | null;
    await expect(inner).not.toBeNull();
    await expect(spacer).not.toBeNull();
    await expect(firstContent).not.toBeNull();
    await expect(getComputedStyle(spacer!).display).toBe("none");
    await expect(
      firstContent!.getBoundingClientRect().top -
        inner!.getBoundingClientRect().top,
    ).toBeLessThanOrEqual(
      Number.parseFloat(getComputedStyle(inner!).paddingTop) + 1,
    );
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Channel lifecycle history"
  args={{
    room: generalRoom,
    currentMemberId: "noor",
    members: communityStoryMembers,
    messages: [
      {
        id: "channel-created",
        authorId: "noor",
        timestamp: "15:50",
        createdAt: "2026-08-29T15:50:00Z",
        content: "",
        activity: { type: "channel-created" as const },
      },
      {
        id: "member-added",
        authorId: "noor",
        timestamp: "15:51",
        createdAt: "2026-08-29T15:51:00Z",
        content: "",
        activity: {
          type: "member-added" as const,
          targetMemberId: "ben",
        },
      },
      {
        id: "member-removed",
        authorId: "ada",
        timestamp: "15:52",
        createdAt: "2026-08-29T15:52:00Z",
        content: "",
        activity: {
          type: "member-removed" as const,
          targetMemberId: "noor",
        },
      },
    ],
    onReply: fn(),
    onAddReaction: fn(),
    onCopyMessage: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getAllByText("You")).toHaveLength(3);
    await expect(canvas.getByText("created this channel")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Ben Stone" }),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "You" })).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Reply in thread" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "More message actions" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 28rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Participation warning stays with composer"
  args={{
    room: generalRoom,
    messages: groupedMessages,
    members: communityStoryMembers,
    disabled: true,
    disabledReason: "Join this room before posting or reacting",
    composerStatus: {
      type: "warning" as const,
      message: "Join this room before posting or reacting",
    },
    composerPlacement: "row" as const,
  }}
  play={async ({ canvas }) => {
    const message = canvas.getByText(
      "Join this room before posting or reacting",
    );
    const warning = message.closest('[data-ui-part="status"]');
    await expect(warning).not.toBeNull();
    await expect(warning).toHaveAttribute("data-status", "warning");
    const composer = warning!.closest('[data-ui-component="ai-chat-composer"]');
    await expect(composer).not.toBeNull();
    await expect(
      warning!.closest('[data-ui-part="composer-dock"]'),
    ).not.toBeNull();
    await expect(
      getComputedStyle(
        composer!.querySelector(':scope > [data-ui-part="body"]')!,
      ).opacity,
    ).toBe("1");
    await expect(
      getComputedStyle(
        composer!.querySelector(
          ':scope > [data-ui-part="body"] > [data-ui-part="input-area"]',
        )!,
      ).opacity,
    ).toBe("0.7");
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveAttribute("contenteditable", "false");
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Reply context drawer"
  args={{
    room: generalRoom,
    messages: groupedMessages,
    members: communityStoryMembers,
    replyTarget: {
      eventId: "message-release",
      roomId: generalRoom.id,
      authorId: communityStoryMembers[0]!.id,
      authorName: "Ada Lovelace",
      content:
        "I have published the AI plugin fixture so the release can be reviewed.",
      kind: generalRoom.kind,
    },
    onSend: fn(),
    onCancelReply: fn(),
  }}
  play={async ({ canvas, args }) => {
    const context = await canvas.findByLabelText("Replying to Ada Lovelace");
    await expect(context).toBeVisible();
    await expect(
      context.closest('[data-ui-component="ai-chat-composer-drawer"]'),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        "I have published the AI plugin fixture so the release can be reviewed.",
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel reply" }));
    await expect(args.onCancelReply).toHaveBeenCalledOnce();
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Edit an authored message"
  args={{
    room: generalRoom,
    messages: groupedMessages,
    members: communityStoryMembers,
    currentMemberId: "ben",
    restrictMessageManagement: true,
    onSaveMessageEdit: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const message = canvas.getByLabelText("Message from You");
    const view = within(message);
    await userEvent.hover(view.getByText(/published the AI plugin fixture/));
    const moreActions = view.getByRole("button", {
      name: "More message actions",
    });
    await waitFor(() => expect(moreActions).toBeVisible());
    await userEvent.click(moreActions);
    await userEvent.click(
      await page.findByRole("menuitem", { name: "Edit message" }),
    );

    await expect(canvas.getByLabelText("Editing message")).toBeVisible();
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await expect(editor).toHaveTextContent(
      "I have published the AI plugin fixture",
    );
    await userEvent.click(editor);
    await userEvent.type(editor, "Update: ");
    await userEvent.click(canvas.getByRole("button", { name: "Save message" }));
    await expect(args.onSaveMessageEdit).toHaveBeenCalledWith(
      "message-release",
      "Update: I have published the AI plugin fixture against the local relay. The release message and its approval resolve correctly, and the rendered registry now links back to the support forum.",
    );
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Forum post author actions"
  args={{
    room: {
      id: "support-ai",
      name: "support-ai",
      kind: "forum" as const,
    },
    messages: [communityStoryMessages[0]!],
    members: communityStoryMembers,
    currentMemberId: "ada",
    restrictMessageManagement: true,
    onSaveMessageEdit: fn(),
    onDeleteMessage: fn(),
    onReportMessage: fn(),
  }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const post = canvas.getByLabelText("Message from You");
    const view = within(post);
    await userEvent.hover(view.getByText(/Morning everyone/));
    const moreActions = view.getByRole("button", {
      name: "More message actions",
    });
    await waitFor(() => expect(moreActions).toBeVisible());
    await userEvent.click(moreActions);
    await expect(
      await page.findByRole("menuitem", { name: "Edit message" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Report message" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Delete message" }),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Empty direct message"
  args={{
    room: {
      id: "dm-fizz",
      name: "Fizz",
      kind: "direct",
      participantIds: ["noor", "fizz"],
      private: true,
    },
    messages: [],
    members: communityStoryMembers,
    directMember: {
      id: "fizz",
      name: "Fizz",
      handle: "fizz",
      initials: "F",
      presence: "online",
    },
    onSend: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Fizz" })).toBeVisible();
    await expect(
      canvas.getByText(
        "This is the beginning of your direct message with Fizz.",
      ),
    ).toBeVisible();
    await expect(
      canvas.getByText("Today", { selector: '[data-ui-part="content"]' }),
    ).toBeVisible();
    await expect(
      canvas
        .getByRole("heading", { name: "Fizz" })
        .parentElement?.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "online");
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Draft survives conversation refresh"
  args={{
    room: generalRoom,
    messages: communityStoryMessages,
    members: communityStoryMembers,
    onSend: fn(),
  }}
  play={async ({ canvas, args }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.type(editor, "Draft before refresh");
    await userEvent.click(
      canvas.getByRole("button", { name: "Receive message update" }),
    );
    await expect(editor).toHaveTextContent("Draft before refresh");
    await userEvent.click(editor);
    await userEvent.keyboard("{End} and after{Enter}");
    await waitFor(() =>
      expect(args.onSend).toHaveBeenCalledWith(
        "Draft before refresh and after",
      ),
    );
  }}
  >{#snippet template(args)}
    <button onclick={() => refreshVersion++}>Receive message update</button>
    <div style="height:38rem">
      <CommunityConversation
        {...args}
        room={{ ...args.room, unreadCount: refreshVersion }}
        currentMemberId={communityStoryMembers[0]!.id}
      />
    </div>
  {/snippet}</Story
>
