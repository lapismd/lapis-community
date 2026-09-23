<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import { npubEncode } from "nostr-tools/nip19";
  import CommunityAgentTranscript from "./CommunityAgentTranscript.svelte";
  import {
    storyActivity,
    storyAgent,
    storyOwnerPubkey,
  } from "../community-agents/story-fixtures.js";
  const { Story } = defineMeta({
    title: "Community/Agents/Activity transcript",
    component: CommunityAgentTranscript,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: "<CommunityAgentTranscript {activity} {agent} />",
        },
      },
    },
  });
</script>

<Story
  name="Turn failure"
  args={{
    agent: storyAgent,
    activity: [
      storyActivity("turn_failed", {
        entry: {
          id: "turn:turn",
          type: "turn",
          state: "failed",
          message:
            "The selected model or thinking level is not supported by this runtime",
          createdAt: new Date(1_700_000_000_000).toISOString(),
        },
      }),
    ],
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText(
        "The selected model or thinking level is not supported by this runtime",
      ),
    ).toBeVisible();
    await expect(canvas.queryByText("Failed to send")).not.toBeInTheDocument();
  }}
/>

<Story
  name="User mention chip"
  args={{
    agent: storyAgent,
    activity: [
      storyActivity("message_update", {
        entry: {
          id: "request",
          type: "message",
          role: "user",
          text: `nostr:${npubEncode(storyAgent.pubkey)} reformat the markdown for clarity please`,
          authorPubkey: storyOwnerPubkey,
          createdAt: new Date(1_700_000_000_000).toISOString(),
        },
      }),
    ],
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText(storyAgent.name)).toBeVisible();
    await expect(canvas.queryByText(/npub1/)).not.toBeInTheDocument();
    await expect(
      canvas
        .getByLabelText("Message from You")
        .querySelector('[data-ui-component="community-member-avatar"]'),
    ).not.toBeNull();
  }}
/>
