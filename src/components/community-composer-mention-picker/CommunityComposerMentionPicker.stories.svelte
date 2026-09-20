<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import {
    communityComposerStoryAgents,
    communityComposerStoryFizz,
    communityComposerStoryHoney,
    communityComposerStoryOwner,
  } from "../community-chat-composer/agent-story-fixtures.js";
  import { communityComposerStoryMembers } from "../community-chat-composer/story-fixtures.js";
  import { communityMentionAutocompleteItems } from "../community-chat-composer/agent-mention-candidates.js";
  import CommunityComposerMentionPicker from "./CommunityComposerMentionPicker.svelte";

  const items = communityMentionAutocompleteItems(
    communityComposerStoryMembers.map((member) =>
      member.id === "ada"
        ? { ...member, id: communityComposerStoryOwner }
        : member,
    ),
    communityComposerStoryAgents,
    "",
    communityComposerStoryOwner,
    "general",
  );

  const { Story } = defineMeta({
    title: "Community/Channels/Composer Mention Picker",
    component: CommunityComposerMentionPicker,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
      docs: {
        source: {
          code: `<CommunityComposerMentionPicker
  query={{ kind: "member", query: "", from: 0, to: 1 }}
  {items}
  showAutoMention
  autoMentionEnabled
  lockedAgentPubkeys={[fizz]}
  onSelect={selectMention}
  onAutoMentionChange={setEnabled}
  onToggleAlwaysAddress={togglePin}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Thread agent rows"
  args={{
    query: { kind: "member", query: "", from: 0, to: 1 },
    items,
    showAutoMention: true,
    autoMentionEnabled: true,
    lockedAgentPubkeys: [communityComposerStoryFizz],
    onSelect: fn(),
    onAutoMentionChange: fn(),
    onToggleAlwaysAddress: fn(),
  }}
  play={async ({ canvas, args }) => {
    await expect(
      canvas.getByRole("switch", { name: "Automatically mention agents" }),
    ).toBeChecked();
    await expect(
      canvas.getByText("Address selected agents in thread replies"),
    ).toBeVisible();
    await expect(
      canvas.getByRole("option", { name: /@Fizz/ }),
    ).toHaveTextContent("agent · managed by you");
    await expect(
      canvas.getByRole("option", { name: /@BHoney/ }),
    ).toHaveTextContent("not in channel");
    await userEvent.click(
      canvas.getByRole("button", { name: /Automatically mention BHoney/ }),
    );
    await expect(args.onToggleAlwaysAddress).toHaveBeenCalledWith(
      communityComposerStoryHoney,
    );
  }}
>
  {#snippet template(args)}
    <div
      style="position: relative; width: min(100%, 28rem); min-height: 18rem;"
    >
      <CommunityComposerMentionPicker {...args} />
    </div>
  {/snippet}
</Story>
