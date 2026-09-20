<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  import {
    communityComposerStoryAgents,
    communityComposerStoryFizz,
    communityComposerStoryOwner,
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
    await expect(canvas.getByLabelText("Addressed agent Fizz")).toBeVisible();
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
    await expect(canvas.getByLabelText("Addressed agent Fizz")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Mention someone" }),
    );
    await expect(
      canvas.getByRole("switch", { name: "Automatically mention agents" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("option", { name: /@BHoney/ }),
    ).toHaveTextContent("not in channel");
  }}
/>
