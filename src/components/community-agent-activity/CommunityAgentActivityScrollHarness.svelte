<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import {
    storyActivity,
    storyAgentPubkey,
    storyAgentState,
    storyOwnerPubkey,
  } from "../community-agents/story-fixtures.js";
  import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";

  const body =
    "The agent recorded a longer activity entry so the exclusive Activity sidebar has to scroll.";
  let extra: CommunityAgentActivityItem[] = $state([]);
  const history = Array.from({ length: 16 }, (_, index) =>
    storyActivity(
      "assistant_message_chunk",
      {
        entry: {
          id: `turn:assistant:${index}`,
          type: "message",
          role: "assistant",
          text:
            index === 0
              ? `Oldest activity message. ${body}`
              : index === 15
                ? `Newest activity message. ${body}`
                : `Activity message ${index}. ${body}`,
          authorPubkey: storyAgentPubkey,
          createdAt: new Date(
            (1_700_000_000 + index * 60) * 1000,
          ).toISOString(),
        },
      },
      index,
    ),
  );
  const model = $derived(
    storyAgentState({
      activityAgent: storyAgentPubkey,
      activity: [...history, ...extra],
    }),
  );
</script>

<div class="agent-activity-scroll-harness">
  <Button
    variant="outline"
    onclick={() => {
      extra = [
        ...extra,
        storyActivity(
          "assistant_message_chunk",
          {
            entry: {
              id: `turn:assistant:later:${extra.length}`,
              type: "message",
              role: "assistant",
              text: `Later activity message ${extra.length}. ${body}`,
              authorPubkey: storyAgentPubkey,
              createdAt: new Date(
                (1_700_001_000 + extra.length * 60) * 1000,
              ).toISOString(),
            },
          },
          100 + extra.length,
        ),
      ];
    }}>Receive later activity</Button
  >
  <CommunityAgentActivity
    {model}
    members={[
      {
        id: storyOwnerPubkey,
        name: "Alex Morgan",
        handle: "alex",
        initials: "AM",
      },
    ]}
    onLatest={() => {}}
    onLoadOlder={() => {}}
    onClearHistory={async () => {}}
  />
</div>

<style>
  .agent-activity-scroll-harness {
    display: flex;
    flex-direction: column;
    height: 32rem;
    min-height: 0;
    overflow: hidden;
    background: var(--background);
  }

  .agent-activity-scroll-harness :global(.agent-activity) {
    flex: 1;
    min-height: 0;
  }
</style>
