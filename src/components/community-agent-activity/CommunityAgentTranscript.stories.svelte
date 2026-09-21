<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import CommunityAgentTranscript from "./CommunityAgentTranscript.svelte";
  import { storyActivity, storyAgent } from "../community-agents/story-fixtures.js";
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
