<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import CommunityWorkspaceSurface from "./CommunityWorkspaceSurface.svelte";
  import {
    createChannelStoryModel,
    createForumIndexStoryModel,
  } from "./story-fixtures.js";

  const baseModel = createChannelStoryModel();
  const directMessageModel = {
    ...baseModel,
    activeRoomId: "dm-ada",
    view: "channel" as const,
    messages: [],
    topics: [],
    currentMemberId: "noor",
  };
  const nonmemberModel = {
    ...baseModel,
    messages: [],
    navigationSections: baseModel.navigationSections.map((section) => ({
      ...section,
      rooms: section.rooms.map((room) =>
        room.id === baseModel.activeRoomId
          ? {
              ...room,
              membership: "not-joined" as const,
              permissions: {
                publish: {
                  state: "denied" as const,
                  reason: "Join this room before posting or reacting",
                },
                join: { state: "enabled" as const },
                leave: { state: "denied" as const },
                update: { state: "denied" as const },
                delete: { state: "denied" as const },
                manageMembers: { state: "denied" as const },
              },
            }
          : room,
      ),
    })),
  };
  const forumBaseModel = createForumIndexStoryModel();
  const forumNonmemberModel = {
    ...forumBaseModel,
    navigationSections: forumBaseModel.navigationSections.map((section) => ({
      ...section,
      rooms: section.rooms.map((room) =>
        room.id === forumBaseModel.activeRoomId
          ? {
              ...room,
              membership: "not-joined" as const,
              permissions: {
                publish: {
                  state: "denied" as const,
                  reason: "Join this room before posting or reacting",
                },
                join: { state: "enabled" as const },
                leave: { state: "denied" as const },
                update: { state: "denied" as const },
                delete: { state: "denied" as const },
                manageMembers: { state: "denied" as const },
              },
            }
          : room,
      ),
    })),
  };
  const scrollableForumNonmemberModel = {
    ...forumNonmemberModel,
    topics: Array.from({ length: 3 }, (_, page) =>
      forumNonmemberModel.topics.map((topic) => ({
        ...topic,
        id: `${topic.id}-${page + 1}`,
      })),
    ).flat(),
  };
  const emptyForumNonmemberModel = {
    ...forumNonmemberModel,
    topics: [],
  };
  const withActiveRoom = (
    membership: "joined" | "not-joined" | "unknown",
    publish: { state: "enabled" | "denied"; reason?: string },
  ) => ({
    ...baseModel,
    navigationSections: baseModel.navigationSections.map((section) => ({
      ...section,
      rooms: section.rooms.map((room) =>
        room.id === baseModel.activeRoomId
          ? {
              ...room,
              membership,
              permissions: {
                publish,
                join: { state: "enabled" as const },
                leave: {
                  state:
                    membership === "joined"
                      ? ("enabled" as const)
                      : ("denied" as const),
                },
                update: { state: "denied" as const },
                delete: { state: "denied" as const },
                manageMembers: { state: "denied" as const },
              },
            }
          : room,
      ),
    })),
  });

  const { Story } = defineMeta({
    title: "Community/Workspace/Participation State",
    component: CommunityWorkspaceSurface,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        description: {
          component:
            "The workspace preserves optional actions and reading state through memoized conversation props. The App Shell warm-navigation contract bounds controller state reads across this production composition.",
        },
        source: {
          language: "svelte",
          code: `<CommunityWorkspaceSurface
  model={community.state.workspace}
  handlers={community.handlers}
  readOnly={room.permissions?.publish.state === "denied"}
  readOnlyReason={room.permissions?.publish.reason}
  operation={community.state.operations[operationKey]}
  onRetryOperation={() => community.retry(operationKey)}
  onDismissOperation={() => community.dismissOperation(operationKey)}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Forum read boundary waits for the end"
  args={{
    model: {
      ...scrollableForumNonmemberModel,
      navigationSections: scrollableForumNonmemberModel.navigationSections.map(
        (section) => ({
          ...section,
          rooms: section.rooms.map((room) => ({
            ...room,
            unreadCount: 3,
            latestUnreadEventId: "forum-head",
          })),
        }),
      ),
    },
    handlers: { onReadRoom: fn() },
  }}
  play={async ({ canvasElement, args }) => {
    const boundary = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="read-boundary"]',
    )!;
    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"], [data-ui-part="viewport"]',
    )!;
    await expect(boundary).not.toBeNull();
    await expect(viewport).not.toBeNull();
    await expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    await expect(args.handlers!.onReadRoom).not.toHaveBeenCalled();
    boundary.scrollIntoView({ block: "end" });
    await waitFor(() =>
      expect(args.handlers!.onReadRoom).toHaveBeenCalledWith(
        args.model.activeRoomId,
        { eventId: "forum-head" },
      ),
    );
    await expect(boundary.getBoundingClientRect().top).toBeLessThanOrEqual(
      viewport.getBoundingClientRect().bottom,
    );
  }}
>
  {#snippet template(args)}
    <div style="width: 48rem; height: 24rem; max-width: 100%;">
      <CommunityWorkspaceSurface {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Known nonmember"
  args={{
    model: nonmemberModel,
    readOnly: true,
    readOnlyReason: "Join this room before posting or reacting",
    showJoinAction: true,
    handlers: {
      onJoinRoom: fn(),
      onBrowseRooms: fn(),
      onCreateAgent: fn(),
    },
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const membership = canvasElement.querySelector(
      '[data-ui-part="room-membership"]',
    );
    await expect(membership).not.toBeNull();
    await expect(membership?.tagName).toBe("FOOTER");
    await expect(membership).toHaveTextContent("Viewing #general");
    const composerDock = membership?.closest<HTMLElement>(
      '[data-ui-part="composer-dock"]',
    );
    const chatLayout = membership?.closest<HTMLElement>(
      '[data-ui-component="ai-chat-layout"]',
    );
    const scrollShell = chatLayout?.querySelector<HTMLElement>(
      '[data-ui-part="scroll-shell"]',
    );
    await expect(composerDock).not.toBeNull();
    await expect(scrollShell).not.toBeNull();
    await expect(scrollShell?.contains(membership)).toBe(false);
    await expect(
      Math.abs(
        (scrollShell?.getBoundingClientRect().bottom ?? 0) -
          (composerDock?.getBoundingClientRect().top ?? 0),
      ),
    ).toBeLessThanOrEqual(1);
    await expect(getComputedStyle(membership!).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await expect(
      canvas.queryByText("Join this room before posting or reacting"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: "#general" }),
    ).toBeVisible();
    await expect(
      canvas.getByText("This is the beginning of the regular channel."),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        "Say hi, ask a question, or share what brought you here.",
      ),
    ).toBeVisible();
    const browse = canvas.getByRole("button", { name: "Browse channels" });
    await expect(browse).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Create a channel" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Create an agent" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("textbox", { name: "Markdown editor" }),
    ).not.toBeInTheDocument();
    const bodyJoin = canvas.getByRole("button", { name: "Join channel" });
    const footerJoin = canvas.getByRole("button", {
      name: "Join to participate",
    });
    await expect(bodyJoin.querySelector("svg")).not.toBeNull();
    await expect(footerJoin.querySelector("svg")).not.toBeNull();
    await userEvent.click(bodyJoin);
    await userEvent.click(footerJoin);
    await userEvent.click(browse);
    await expect(args.handlers?.onJoinRoom).toHaveBeenCalledTimes(2);
    await expect(args.handlers?.onJoinRoom).toHaveBeenCalledWith("general");
    await expect(args.handlers?.onBrowseRooms).toHaveBeenCalledWith("channel");
  }}
/>

<Story
  name="Empty forum nonmember"
  args={{
    model: emptyForumNonmemberModel,
    readOnly: true,
    readOnlyReason: "Join this room before posting or reacting",
    showJoinAction: true,
    handlers: { onJoinRoom: fn(), onBrowseRooms: fn() },
  }}
  play={async ({ canvas, args }) => {
    await expect(
      canvas.getByRole("heading", { name: "support-ai" }),
    ).toBeVisible();
    await expect(
      canvas.getByText("This forum has no active topics yet."),
    ).toBeVisible();
    const bodyJoin = canvas.getByRole("button", { name: "Join forum" });
    const footerJoin = canvas.getByRole("button", {
      name: "Join to participate",
    });
    const browse = canvas.getByRole("button", { name: "Browse forums" });
    await expect(
      canvas.queryByRole("button", { name: "Create a forum" }),
    ).not.toBeInTheDocument();
    await userEvent.click(bodyJoin);
    await userEvent.click(footerJoin);
    await userEvent.click(browse);
    await expect(args.handlers?.onJoinRoom).toHaveBeenCalledTimes(2);
    await expect(args.handlers?.onJoinRoom).toHaveBeenCalledWith("support-ai");
    await expect(args.handlers?.onBrowseRooms).toHaveBeenCalledWith("forum");
  }}
/>

<Story
  name="Empty channel manager"
  args={{
    model: { ...withActiveRoom("joined", { state: "enabled" }), messages: [] },
    handlers: { onBrowseRooms: fn(), onCreateRoom: fn() },
  }}
  play={async ({ canvas, args }) => {
    const create = canvas.getByRole("button", { name: "Create a channel" });
    await expect(create).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Create an agent" }),
    ).not.toBeInTheDocument();
    await userEvent.click(create);
    await expect(args.handlers?.onCreateRoom).toHaveBeenCalledWith("channel");
  }}
/>

<Story
  name="Empty direct message"
  args={{
    model: directMessageModel,
    handlers: { onOpenProfile: fn(), onBrowseRooms: fn() },
  }}
  play={async ({ canvas, args }) => {
    await expect(
      canvas.queryByRole("heading", { name: "#Ada Lovelace" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        "This is the beginning of your direct message with Ada Lovelace.",
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Browse channels" }),
    ).not.toBeInTheDocument();
    const profile = canvas.getByRole("button", {
      name: "View Ada Lovelace's profile",
    });
    await expect(
      profile.querySelector('[data-ui-component="community-member-avatar"]'),
    ).not.toBeNull();
    await userEvent.click(profile);
    await expect(args.handlers?.onOpenProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ada" }),
    );
    await expect(args.handlers?.onBrowseRooms).not.toHaveBeenCalled();
  }}
/>

<Story
  name="Known forum nonmember"
  args={{
    model: scrollableForumNonmemberModel,
    readOnly: true,
    readOnlyReason: "Join this room before posting or reacting",
    showJoinAction: true,
    handlers: { onJoinRoom: fn(), onCreateTopic: fn() },
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const membership = canvasElement.querySelector(
      '[data-ui-part="room-membership"]',
    );
    const scrollArea = canvasElement.querySelector<HTMLElement>(
      '[data-community-part="forum-scroll-shell"][data-ui-component="scroll-area"]',
    );
    const scrollViewport = scrollArea?.querySelector<HTMLElement>(
      '[data-ui-part="scroll-area-viewport"]',
    );
    await expect(membership).not.toBeNull();
    await expect(scrollArea).not.toBeNull();
    await expect(scrollViewport).not.toBeNull();
    await expect(scrollArea).toHaveAttribute("data-scroll-visibility", "hover");
    await expect(membership).toHaveTextContent("Viewing support-ai");
    await expect(scrollArea?.contains(membership)).toBe(false);
    await expect(scrollViewport!.scrollHeight).toBeGreaterThan(
      scrollViewport!.clientHeight,
    );
    await expect(
      Math.abs(
        scrollArea!.getBoundingClientRect().bottom -
          membership!.getBoundingClientRect().top,
      ),
    ).toBeLessThanOrEqual(1);
    const footerTop = membership!.getBoundingClientRect().top;
    scrollViewport!.scrollTop = scrollViewport!.scrollHeight;
    scrollViewport!.dispatchEvent(new Event("scroll"));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await expect(scrollViewport!.scrollTop).toBeGreaterThan(0);
    await expect(
      Math.abs(membership!.getBoundingClientRect().top - footerTop),
    ).toBeLessThanOrEqual(1);
    const join = canvas.getByRole("button", { name: "Join to participate" });
    await expect(join.querySelector("svg")).not.toBeNull();
    await userEvent.click(join);
    await expect(args.handlers?.onJoinRoom).toHaveBeenCalledWith("support-ai");
    await expect(
      canvas.queryByRole("textbox", { name: "Markdown editor" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("Join this room before posting or reacting"),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <div
      style="height: min(34rem, 80vh); min-height: 24rem; border: 1px solid var(--border);"
    >
      <CommunityWorkspaceSurface {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Join requested"
  args={{
    model: nonmemberModel,
    readOnly: true,
    readOnlyReason: "Join this room before posting or reacting",
    showJoinAction: true,
    operation: {
      status: "accepted" as const,
      message: "Join requested. Waiting for membership confirmation.",
    },
    handlers: { onJoinRoom: fn() },
  }}
  play={async ({ canvas }) => {
    const requested = canvas.getAllByRole("button", {
      name: "Join requested",
    });
    await expect(requested).toHaveLength(2);
    for (const button of requested) await expect(button).toBeDisabled();
  }}
/>

<Story
  name="Persistent relay failure"
  args={{
    model: baseModel,
    operation: {
      status: "failed" as const,
      message: "restricted: join the group before publishing",
      failure: {
        category: "restricted" as const,
        message: "restricted: join the group before publishing",
        relayReason: "restricted: join the group before publishing",
        retryable: false,
      },
    },
    onDismissOperation: fn(),
  }}
  play={async ({ canvas, args }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent(
      "restricted: join the group before publishing",
    );
    await expect(
      alert.closest('[data-ui-component="ai-chat-composer"]'),
    ).not.toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(args.onDismissOperation).toHaveBeenCalledOnce();
  }}
/>

<Story
  name="Joined member"
  args={{
    model: withActiveRoom("joined", { state: "enabled" }),
    handlers: { onSendMessage: fn() },
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveAttribute("contenteditable", "true");
  }}
/>

<Story
  name="Restricted writer"
  args={{
    model: withActiveRoom("joined", {
      state: "denied",
      reason: "A writer or administrator role is required to publish here",
    }),
    readOnly: true,
    readOnlyReason:
      "A writer or administrator role is required to publish here",
  }}
  play={async ({ canvas }) => {
    const warning = canvas.getByText(
      "A writer or administrator role is required to publish here",
    );
    await expect(warning).toBeVisible();
    await expect(
      warning.closest('[data-ui-component="ai-chat-composer"]'),
    ).not.toBeNull();
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveAttribute("contenteditable", "false");
  }}
/>

<Story
  name="Unknown permission"
  args={{
    model: withActiveRoom("unknown", { state: "enabled" }),
    handlers: { onSendMessage: fn() },
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByText("Participation unavailable"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveAttribute("contenteditable", "true");
  }}
/>

<Story
  name="Offline"
  args={{
    model: withActiveRoom("joined", { state: "enabled" }),
    readOnly: true,
    readOnlyReason: "Reconnect to participate",
  }}
  play={async ({ canvas }) => {
    const warning = canvas.getByText("Reconnect to participate");
    await expect(warning).toBeVisible();
    await expect(
      warning.closest('[data-ui-component="ai-chat-composer"]'),
    ).not.toBeNull();
  }}
/>

<Story
  name="Action pending"
  args={{
    model: withActiveRoom("joined", { state: "enabled" }),
    readOnly: true,
    readOnlyReason: "This action is still being published",
    operation: { status: "pending" as const },
  }}
  play={async ({ canvas }) => {
    const warning = canvas.getByText("This action is still being published");
    await expect(warning).toBeVisible();
    await expect(
      warning.closest('[data-ui-component="ai-chat-composer"]'),
    ).not.toBeNull();
    await expect(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
    ).toHaveAttribute("contenteditable", "false");
  }}
/>

<Story
  name="Retryable network failure"
  args={{
    model: baseModel,
    operation: {
      status: "failed" as const,
      message: "Connection lost while publishing",
      failure: {
        category: "network" as const,
        message: "Connection lost while publishing",
        retryable: true,
      },
    },
    onRetryOperation: fn(),
  }}
  play={async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(args.onRetryOperation).toHaveBeenCalledOnce();
  }}
/>
