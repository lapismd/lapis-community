<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

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
