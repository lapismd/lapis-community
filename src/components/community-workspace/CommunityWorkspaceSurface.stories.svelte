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
  play={async ({ canvas, args }) => {
    await expect(
      canvas.getByText("Join this room before posting or reacting"),
    ).toBeVisible();
    const join = canvas.getByRole("button", { name: "Join Channel" });
    await expect(join).toHaveClass("community-workspace-surface__action-card");
    await expect(join.querySelector("svg")).not.toBeNull();
    await userEvent.click(join);
    await expect(args.handlers?.onJoinRoom).toHaveBeenCalledWith("general");
    await expect(canvas.getByRole("combobox")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  }}
/>

<Story
  name="Known forum nonmember"
  args={{
    model: forumNonmemberModel,
    readOnly: true,
    readOnlyReason: "Join this room before posting or reacting",
    showJoinAction: true,
    handlers: { onJoinRoom: fn(), onCreateTopic: fn() },
  }}
  play={async ({ canvas, args }) => {
    const join = canvas.getByRole("button", { name: "Join Forum" });
    await expect(join).toHaveClass("community-workspace-surface__action-card");
    await expect(join.querySelector("svg")).not.toBeNull();
    await userEvent.click(join);
    await expect(args.handlers?.onJoinRoom).toHaveBeenCalledWith("support-ai");
    const topicComposer = canvas.getByRole("button", {
      name: "Start a new post in support-ai",
    });
    await expect(topicComposer).toBeDisabled();
    await expect(
      topicComposer.getBoundingClientRect().top -
        join.getBoundingClientRect().bottom,
    ).toBeGreaterThanOrEqual(16);
  }}
/>

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
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "restricted: join the group before publishing",
    );
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
    await expect(canvas.getByRole("combobox")).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
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
    await expect(
      canvas.getByText(
        "A writer or administrator role is required to publish here",
      ),
    ).toBeVisible();
    await expect(canvas.getByRole("combobox")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
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
    await expect(canvas.getByRole("combobox")).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
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
    await expect(canvas.getByText("Reconnect to participate")).toBeVisible();
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
    await expect(
      canvas.getByText("This action is still being published"),
    ).toBeVisible();
    await expect(canvas.getByRole("combobox")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
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
