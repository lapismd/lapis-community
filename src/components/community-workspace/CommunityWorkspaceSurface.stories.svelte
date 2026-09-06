<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import CommunityWorkspaceSurface from "./CommunityWorkspaceSurface.svelte";
  import {
    createChannelStoryModel,
    createForumIndexStoryModel,
  } from "./story-fixtures.js";

  const baseModel = createChannelStoryModel();
  const nonmemberModel = {
    ...baseModel,
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
  name="Known nonmember"
  args={{
    model: nonmemberModel,
    readOnly: true,
    readOnlyReason: "Join this room before posting or reacting",
    showJoinAction: true,
    handlers: { onJoinRoom: fn() },
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
      canvas.queryByRole("button", { name: "Browse channels" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("textbox", { name: "Markdown editor" }),
    ).not.toBeInTheDocument();
    const join = canvas.getByRole("button", { name: "Join to participate" });
    await expect(join.querySelector("svg")).not.toBeNull();
    await userEvent.click(join);
    await expect(args.handlers?.onJoinRoom).toHaveBeenCalledWith("general");
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
    const scrollShell = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="forum-scroll-shell"]',
    );
    await expect(membership).not.toBeNull();
    await expect(scrollShell).not.toBeNull();
    await expect(membership).toHaveTextContent("Viewing support-ai");
    await expect(scrollShell?.contains(membership)).toBe(false);
    await expect(scrollShell!.scrollHeight).toBeGreaterThan(
      scrollShell!.clientHeight,
    );
    await expect(
      Math.abs(
        scrollShell!.getBoundingClientRect().bottom -
          membership!.getBoundingClientRect().top,
      ),
    ).toBeLessThanOrEqual(1);
    const footerTop = membership!.getBoundingClientRect().top;
    scrollShell!.scrollTop = scrollShell!.scrollHeight;
    scrollShell!.dispatchEvent(new Event("scroll"));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await expect(scrollShell!.scrollTop).toBeGreaterThan(0);
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
    const requested = canvas.getByRole("button", { name: "Join requested" });
    await expect(requested).toBeDisabled();
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
