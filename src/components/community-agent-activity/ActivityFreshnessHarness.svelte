<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import {
    storyAgentState,
    storyAgentPubkey,
    storyActivity,
  } from "../community-agents/story-fixtures.js";
  import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
  let recovered = $state(false);
  const context = {
    kind: "thread" as const,
    channelId: "general",
    threadRootId: "root",
  };
  const scopeKey = "scope/thread/root";
  const createdAt = "2026-09-19T00:00:00.000Z";
  const frame = (
    seq: number,
    turnId: string,
    entry?: object,
  ): CommunityAgentActivityItem => {
    const item = storyActivity(
      entry ? "transcript" : "request_status",
      {
        scopeKey,
        lifecycleRequestId: turnId,
        state: "running",
        ...(entry ? { entry } : {}),
      },
      seq,
    );
    return {
      ...item,
      frame: {
        ...item.frame,
        sessionId: "session",
        turnId,
        channelId: "general",
      },
    };
  };
  const activity = [
    frame(1, "thinking"),
    frame(2, "thinking", {
      id: "thinking",
      type: "thinking",
      state: "streaming",
      text: "Inspecting the repository",
      createdAt,
    }),
    frame(3, "tool"),
    frame(4, "tool", {
      id: "tool",
      type: "tool",
      toolId: "read",
      name: "Read README",
      state: "running",
      input: '{"path":"README.md"}',
      createdAt,
    }),
  ];
  const model = $derived(
    storyAgentState({
      activityAgent: storyAgentPubkey,
      activityContext: context,
      activity,
      activitySyncStatus: recovered ? "caught-up" : "unavailable",
      activityUnavailable: [{ agentPubkey: storyAgentPubkey, context }],
      conversationScopes: Object.fromEntries(
        ["thinking", "tool"].map((turnId) => [
          turnId,
          {
            agentPubkey: storyAgentPubkey,
            scopeKey,
            threadRootId: "root",
            channelId: "general",
            requestId: turnId,
            sessionId: "session",
            turnId,
            active: true,
            state: recovered ? "running" : "unknown",
          },
        ]),
      ),
    }),
  );
</script>

<Button onclick={() => (recovered = true)}>Receive current snapshot</Button>
<CommunityAgentActivity
  {model}
  onLatest={() => {}}
  onLoadOlder={() => {}}
  onClearHistory={async () => {}}
/>
