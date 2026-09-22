<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import CommunityComposerSlashStoryHost from "./CommunityComposerSlashStoryHost.svelte";
  import {
    communityComposerStoryEmojis,
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "./story-fixtures.js";

  const onSubmit = fn();
  const storyRooms = communityComposerStoryRooms.map((room) =>
    room.id === "plugin-development"
      ? { ...room, isProjectChannel: true }
      : room,
  );
  const commonArgs = {
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: storyRooms,
    communityEmojis: communityComposerStoryEmojis,
    currentMemberId: "ada",
    onSubmit,
  };

  const { Story } = defineMeta({
    title: "Community/Channels/Chat Composer Entity Links",
    component: CommunityComposerSlashStoryHost,
    tags: ["visual-pending"],
    parameters: { layout: "padded" },
  });

  function expectRoomOption(
    canvas: {
      getByRole: (role: string, options: { name: RegExp }) => HTMLElement;
    },
    name: RegExp,
    kind: "channel" | "forum" | "project-channel",
  ): HTMLElement {
    const option = canvas.getByRole("option", { name });
    expect(option).not.toHaveTextContent(/\bForum\b/);
    expect(option).not.toHaveTextContent(/\bChannel\b/);
    if (kind === "project-channel") {
      expect(
        option.querySelector("[data-ui-part='project-channel-icon']"),
      ).not.toBeNull();
      return option;
    }
    expect(option.querySelector(`[data-room-kind='${kind}']`)).not.toBeNull();
    expect(
      option.querySelector("[data-ui-part='project-channel-icon']"),
    ).toBeNull();
    return option;
  }
</script>

<Story
  name="Hash picker uses room icons"
  args={commonArgs}
  play={async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "#");
    await canvas.findByRole("option", { name: /#announcements/ });
    expectRoomOption(canvas, /#announcements/, "channel");
    expectRoomOption(canvas, /#support-ai/, "forum");
    expectRoomOption(canvas, /#plugin-development/, "project-channel");
  }}
/>

<Story
  name="Slash channels picker uses room icons"
  args={commonArgs}
  play={async ({ canvas }) => {
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await userEvent.click(editor);
    await userEvent.type(editor, "/channels/");
    await canvas.findByRole("option", { name: /announcements/i });
    expectRoomOption(canvas, /announcements/i, "channel");
    expectRoomOption(canvas, /support-ai/i, "forum");
    expectRoomOption(canvas, /plugin-development/i, "project-channel");
  }}
/>

<Story
  name="Hash room token is a removable chip"
  args={{
    ...commonArgs,
    value: "See #general and #support-ai.",
  }}
  play={async ({ canvas, canvasElement }) => {
    const channel = await waitFor(() => {
      const found = canvas.getByRole("button", { name: "#general" });
      expect(found).toBeVisible();
      return found;
    });
    const forum = canvas.getByRole("button", { name: "#support-ai" });
    await expect(channel).toHaveAttribute("data-link-kind", "channel");
    await expect(forum).toHaveAttribute("data-link-kind", "forum");
    expect(channel.querySelector("[data-room-kind='channel']")).not.toBeNull();
    expect(forum.querySelector("[data-room-kind='forum']")).not.toBeNull();
    await expect(
      canvas.getByRole("button", { name: "Remove #general" }),
    ).toBeVisible();
    await expect(
      canvasElement.querySelector("[data-ui-part='composer-removable-token']"),
    ).not.toBeNull();
  }}
/>

<Story
  name="Dismiss removes a room chip"
  args={{
    ...commonArgs,
    value: "See #general please.",
  }}
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("button", { name: "#general" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove #general" }),
    );
    await waitFor(() => {
      expect(canvas.queryByRole("button", { name: "#general" })).toBeNull();
      expect(
        canvasElement.querySelector("[data-ui-part='composer-chip-dismiss']"),
      ).toBeNull();
    });
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await expect(editor).toHaveTextContent("See please.");
    await expect(editor).not.toHaveTextContent("#general");
  }}
/>
