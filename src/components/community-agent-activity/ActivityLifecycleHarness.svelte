<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import {
    storyAgentState,
    storyAgentPubkey,
    storyActivity,
  } from "../community-agents/story-fixtures.js";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  let stage = $state(0);
  const createdAt = "2026-09-19T00:00:00.000Z";
  const frames: CommunityAgentTranscriptEntry[] = [
    { id: "turn:turn", type: "turn", state: "started", createdAt },
    {
      id: "turn:thinking",
      type: "thinking",
      state: "streaming",
      text: "Inspecting the README.",
      createdAt,
    },
    {
      id: "turn:tool:read",
      type: "tool",
      toolId: "read",
      name: "Read README",
      state: "running",
      input: '{"path":"README.md"}',
      createdAt,
    },
    {
      id: "turn:tool:read",
      type: "tool",
      toolId: "read",
      name: "Read README",
      state: "running",
      output: "README contents",
      createdAt,
    },
    { id: "turn:turn", type: "turn", state: "completed", createdAt },
  ];
  const model = $derived(
    storyAgentState({
      activityAgent: storyAgentPubkey,
      activity: frames
        .slice(0, stage + 2)
        .map((entry, index) =>
          storyActivity("transcript", { entry }, index + 1),
        ),
      controllerScopes: {
        run: {
          agentPubkey: storyAgentPubkey,
          scopeKey: "group/general",
          channelId: "general",
          active: stage < 3,
          sessionId: "session",
          turnId: "turn",
        },
      },
      hasOlder: true,
    }),
  );
</script>

<div style="width: min(320px, 100vw)">
  <Button onclick={() => (stage += 1)} disabled={stage === 3}
    >Next update</Button
  >
  <CommunityAgentActivity
    {model}
    onLatest={() => {}}
    onLoadOlder={() => {}}
    onClearHistory={async () => {}}
  />
</div>
