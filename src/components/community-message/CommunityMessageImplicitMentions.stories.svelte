<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

  import { communityComposerStoryFizz } from "../community-chat-composer/agent-story-fixtures.js";
  import {
    communityStoryMembers,
    communityStoryMessages,
  } from "../community-workspace/story-fixtures.js";
  import CommunityMessage from "./CommunityMessage.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Message",
    component: CommunityMessage,
    tags: ["visual-pending"],
  });

  const author = communityStoryMembers[1]!;
  const fizz = {
    id: communityComposerStoryFizz,
    name: "Fizz",
    handle: "fizz",
    initials: "FZ",
    kind: "agent" as const,
  };
  const members = [...communityStoryMembers, fizz];
</script>

<Story
  name="Implicit mention avatars"
  args={{
    message: {
      ...communityStoryMessages[1]!,
      id: "message-implicit-mention",
      content: "please continue from the last checkpoint.",
      mentionPubkeys: [fizz.id],
      reactions: [],
      replyCount: 0,
      replyParticipantIds: [],
    },
    author,
    members,
    density: "compact",
    avatarShape: "rounded",
    onOpenProfile: fn(),
  }}
  play={async ({ canvas }) => {
    const message = canvas.getByLabelText("Message from Ben Stone");
    const metadata = message.querySelector(".community-message__metadata");
    await expect(metadata).not.toBeNull();
    const tagged = metadata!.querySelector<HTMLElement>(
      '[data-ui-part="implicit-mentions"]',
    );
    await expect(tagged).not.toBeNull();
    await expect(
      canvas.getByRole("group", { name: "Tagged Fizz" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "View Fizz's profile" }),
    ).toBeVisible();
    await expect(message.textContent).not.toMatch(/@Fizz/u);
    const timestamp = metadata!.querySelector(
      '[data-ui-component="ai-chat-message-metadata"]',
    );
    await expect(timestamp).not.toBeNull();
    await expect(
      timestamp!.compareDocumentPosition(tagged!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }}
/>

<Story
  name="In-body mention hides metadata avatars"
  args={{
    message: {
      ...communityStoryMessages[1]!,
      id: "message-body-mention",
      content: "@Fizz please continue from the last checkpoint.",
      mentionPubkeys: [fizz.id],
      reactions: [],
      replyCount: 0,
      replyParticipantIds: [],
    },
    author,
    members,
    density: "compact",
    avatarShape: "rounded",
  }}
  play={async ({ canvas }) => {
    const message = canvas.getByLabelText("Message from Ben Stone");
    await expect(
      message.querySelector('[data-ui-part="implicit-mentions"]'),
    ).toBeNull();
    await expect(canvas.getByRole("button", { name: "Fizz" })).toBeVisible();
  }}
/>
