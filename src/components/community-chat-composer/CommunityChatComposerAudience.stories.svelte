<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  import {
    communityComposerStoryAgents,
    communityComposerStoryFizz,
    communityComposerStoryOwner,
    composerMentionLockButton,
  } from "./agent-story-fixtures.js";
  import {
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "./story-fixtures.js";
  import {
    resetPersistentAgentAudienceStore,
    setPersistentAgentAudienceEnabled,
  } from "./persistent-agent-audience.js";

  const { Story } = defineMeta({
    title: "Community/Channels/Chat Composer",
    component: CommunityChatComposer,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
    },
  });
</script>

<Story
  name="Thread agent audience"
  args={{
    class: "community-chat-composer-story",
    members: communityComposerStoryMembers,
    rooms: communityComposerStoryRooms,
    currentMemberId: communityComposerStoryOwner,
    agents: communityComposerStoryAgents,
    audience: {
      ownerPubkey: communityComposerStoryOwner,
      channelId: "general",
      threadRootId: "message-release",
    },
    initialAgentPubkeys: [communityComposerStoryFizz],
    onSubmit: fn(),
  }}
  play={async ({ canvas, args }) => {
    resetPersistentAgentAudienceStore();
    setPersistentAgentAudienceEnabled(true);
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await waitFor(() => expect(editor).toHaveTextContent(/Fizz/));
    await expect(composerMentionLockButton(canvas)).toBeVisible();
    await expect(
      composerMentionLockButton(canvas)?.querySelector(
        "[data-ui-part='composer-mention-dismiss']",
      ),
    ).not.toBeNull();
    await expect(
      canvas
        .getByRole("button", { name: "Fizz" })
        .querySelector("[data-ui-component='community-member-avatar']"),
    ).not.toBeNull();
    await userEvent.click(editor);
    await userEvent.keyboard("{End} continue{Enter}");
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          mentionPubkeys: expect.arrayContaining([communityComposerStoryFizz]),
        }),
      ),
    );
    await waitFor(() => expect(editor).toHaveTextContent(/Fizz/));
    await expect(composerMentionLockButton(canvas)).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Mention someone" }),
    );
    await expect(
      canvas.getByRole("switch", { name: "Automatically mention agents" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("option", { name: /@BHoney/ }),
    ).toHaveTextContent("not in channel");
    const lock = composerMentionLockButton(canvas);
    await expect(lock).not.toBeNull();
    await userEvent.click(lock!);
    await waitFor(() => expect(composerMentionLockButton(canvas)).toBeNull());
    await waitFor(() => expect(editor).not.toHaveTextContent(/Fizz/));
  }}
/>

<Story
  name="Colliding agent mention"
  args={{
    class: "community-chat-composer-story",
    members: [
      ...communityComposerStoryMembers,
      {
        id: "nyra",
        name: "Nyra",
        handle: "nyra-human",
        initials: "NY",
      },
    ],
    rooms: communityComposerStoryRooms,
    currentMemberId: communityComposerStoryOwner,
    agents: [
      ...communityComposerStoryAgents,
      {
        pubkey: "c".repeat(64),
        name: "Nyra",
        ownerPubkey: communityComposerStoryOwner,
        channelIds: ["general"],
      },
    ],
    audience: {
      ownerPubkey: communityComposerStoryOwner,
      channelId: "general",
      threadRootId: "message-nyra",
    },
    initialAgentPubkeys: ["c".repeat(64)],
    onSubmit: fn(),
  }}
  play={async ({ canvas }) => {
    resetPersistentAgentAudienceStore();
    setPersistentAgentAudienceEnabled(true);
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await waitFor(() => expect(editor).toHaveTextContent(/Nyra/));
    await expect(
      canvas
        .getByRole("button", { name: "Nyra" })
        .querySelector("[data-ui-component='community-member-avatar']"),
    ).not.toBeNull();
    await waitFor(() => {
      expect(composerMentionLockButton(canvas)).toBeVisible();
      expect(composerMentionLockButton(canvas)).toHaveAccessibleName(
        "Don't automatically mention Nyra in this thread",
      );
    });
  }}
/>
