<script module lang="ts">
  import consumerSource from "../community-patterns/examples/AgentDiscussionExample.svelte?raw";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import CommunityAgentCheckpointDivider from "./CommunityAgentCheckpointDivider.svelte";
  import {
    checkpoint,
    commit,
  } from "../../testing/agent-conversation-fixture.js";
  const { Story } = defineMeta({
    title: "Community/Agents/Checkpoint divider",
    component: CommunityAgentCheckpointDivider,
    tags: ["visual-pending"],
    parameters: {
      docs: { source: { code: consumerSource, language: "svelte" } },
    },
    args: {
      commitIds: [commit],
      repositoryAddress: checkpoint.repositoryAddress,
    },
  });
</script>

<Story
  name="Linked checkpoint"
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("link")).toHaveAttribute(
      "href",
      expect.stringContaining(`/commits/${commit}`),
    );
  }}
/>
