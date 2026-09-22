<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

  import {
    communityComposerStoryFizz,
    communityComposerStoryOwner,
  } from "../community-chat-composer/agent-story-fixtures.js";
  import {
    communityStoryMembers,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Panel",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
  });

  const nyraMember = {
    id: communityComposerStoryFizz,
    name: "Nyra",
    handle: "nyra",
    initials: "NY",
  };
</script>

<Story
  name="Agent author and mention avatars"
  args={{
    thread: {
      ...communityStoryThread,
      messages: [
        communityStoryThread.messages[0]!,
        {
          id: "thread-nyra",
          authorId: communityComposerStoryFizz,
          parentMessageId: communityStoryThread.rootMessageId,
          timestamp: "09:28",
          content: "Ready when you are.",
        },
        {
          id: "thread-mention-nyra",
          authorId: "ada",
          parentMessageId: "thread-nyra",
          timestamp: "09:29",
          content: "Thanks @Nyra",
          mentionPubkeys: [communityComposerStoryFizz],
        },
      ],
    },
    members: [nyraMember, ...communityStoryMembers],
    agents: [
      {
        pubkey: communityComposerStoryFizz,
        name: "Nyra",
        avatarUrl: "🧭",
        ownerPubkey: communityComposerStoryOwner,
        channelIds: ["general"],
      },
    ],
    onSendReply: fn(),
    onOpenProfile: fn(),
  }}
  play={async ({ canvas }) => {
    const author = canvas.getByRole("button", {
      name: "View Nyra's profile",
    });
    await expect(author).toHaveAttribute("data-shape", "rounded");
    await expect(
      author.querySelector('[data-ui-part="emoji"]'),
    ).toHaveTextContent("🧭");
    const mention = canvas.getByRole("button", { name: "Nyra" });
    const mentionAvatar = mention.querySelector(
      '[data-ui-component="community-member-avatar"]',
    );
    await expect(mentionAvatar).toHaveAttribute("data-shape", "rounded");
    await expect(
      mentionAvatar?.querySelector('[data-ui-part="emoji"]'),
    ).toHaveTextContent("🧭");
    await expect(mentionAvatar?.querySelector("img")).toBeNull();
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 28rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityThreadPanel {...args} />
    </div>
  {/snippet}
</Story>
