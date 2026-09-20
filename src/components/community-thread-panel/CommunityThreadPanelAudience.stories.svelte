<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryNavigation,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import {
    communityComposerStoryAgents,
    communityComposerStoryFizz,
    communityComposerStoryOwner,
  } from "../community-chat-composer/agent-story-fixtures.js";
  import {
    resetPersistentAgentAudienceStore,
    setPersistentAgentAudienceEnabled,
  } from "../community-chat-composer/persistent-agent-audience.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Panel",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Persistent agent mentions"
  args={{
    thread: {
      ...communityStoryThread,
      messages: communityStoryThread.messages.map((message) =>
        message.id === communityStoryThread.rootMessageId
          ? { ...message, mentionPubkeys: [communityComposerStoryFizz] }
          : message,
      ),
    },
    members: [
      {
        id: communityComposerStoryOwner,
        name: "Ada Lovelace",
        handle: "ada",
        initials: "AL",
      },
      ...communityStoryMembers.filter((member) => member.id !== "ada"),
    ],
    rooms: communityStoryNavigation.flatMap((section) => section.rooms),
    agents: communityComposerStoryAgents,
    currentMemberId: communityComposerStoryOwner,
    onSendReply: fn(),
  }}
  play={async ({ canvas }) => {
    resetPersistentAgentAudienceStore();
    setPersistentAgentAudienceEnabled(true);
    const editor = canvas.getByRole("textbox", { name: "Markdown editor" });
    await waitFor(() => expect(editor).toHaveTextContent(/Fizz/));
    await expect(canvas.getByLabelText("Addressed agent Fizz")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Mention someone" }),
    );
    await expect(
      canvas.getByRole("switch", { name: "Automatically mention agents" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("option", { name: /@Fizz/ }),
    ).toHaveTextContent("managed by you");
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
