<script module lang="ts">
  import consumerSource from "../community-patterns/examples/AgentDiscussionExample.svelte?raw";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityAgentThreadContext from "./CommunityAgentThreadContext.svelte";
  import Harness from "../../testing/AgentConversationHarness.svelte";
  import {
    agent,
    request,
    response,
  } from "../../testing/agent-conversation-fixture.js";
  import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
  const liveActivity: CommunityAgentActivityItem[] = [
    {
      id: "live-status",
      agentPubkey: agent,
      createdAt: 1_700_000_001,
      frame: {
        version: 2,
        seq: 1,
        sessionId: "live-session",
        turnId: "live-turn",
        channelId: "room",
        timestamp: "2023-11-14T22:13:21.000Z",
        kind: "request_status",
        payload: {
          lifecycleRequestId: `fixture-agent:${request.id}`,
          scopeKey: `relay/room/agent/thread/${request.id}`,
          threadRootId: request.id,
          state: "running",
          preview: "Working on README",
        },
      },
    },
    {
      id: "live-tool",
      agentPubkey: agent,
      createdAt: 1_700_000_002,
      frame: {
        version: 2,
        seq: 2,
        sessionId: "live-session",
        turnId: "live-turn",
        channelId: "room",
        timestamp: "2023-11-14T22:13:22.000Z",
        kind: "tool_update",
        payload: {
          lifecycleRequestId: `fixture-agent:${request.id}`,
          scopeKey: `relay/room/agent/thread/${request.id}`,
          threadRootId: request.id,
          entry: {
            id: "live-turn:tool:read",
            type: "tool",
            toolId: "read",
            name: "Read workspace file",
            state: "completed",
            output: "README",
            createdAt: "2023-11-14T22:13:22.000Z",
          },
        },
      },
    },
    {
      id: "live-thinking",
      agentPubkey: agent,
      createdAt: 1_700_000_003,
      frame: {
        version: 2,
        seq: 3,
        sessionId: "live-session",
        turnId: "live-turn",
        channelId: "room",
        timestamp: "2023-11-14T22:13:23.000Z",
        kind: "thinking_update",
        payload: {
          lifecycleRequestId: `fixture-agent:${request.id}`,
          scopeKey: `relay/room/agent/thread/${request.id}`,
          threadRootId: request.id,
          entry: {
            id: "live-thinking",
            type: "thinking",
            text: "Working through the private owner transcript.",
            state: "streaming",
            createdAt: "2023-11-14T22:13:23.000Z",
          },
        },
      },
    },
    {
      id: "source-backed-message",
      agentPubkey: agent,
      createdAt: 1_700_000_004,
      frame: {
        version: 2,
        seq: 4,
        sessionId: "live-session",
        turnId: "live-turn",
        channelId: "room",
        timestamp: "2023-11-14T22:13:24.000Z",
        kind: "message_update",
        payload: {
          lifecycleRequestId: `fixture-agent:${request.id}`,
          scopeKey: `relay/room/agent/thread/${request.id}`,
          threadRootId: request.id,
          entry: {
            id: "source-backed-message",
            type: "message",
            role: "assistant",
            authorPubkey: agent,
            text: "Duplicate public reply",
            sourceEventId: response.id,
            createdAt: "2023-11-14T22:13:24.000Z",
          },
        },
      },
    },
    {
      id: "unrelated-request",
      agentPubkey: agent,
      createdAt: 1_700_000_005,
      frame: {
        version: 2,
        seq: 5,
        sessionId: "other-session",
        turnId: "other-turn",
        channelId: "room",
        timestamp: "2023-11-14T22:13:25.000Z",
        kind: "thinking_update",
        payload: {
          lifecycleRequestId: `fixture-agent:${"f".repeat(64)}`,
          scopeKey: `relay/room/agent/thread/${request.id}`,
          threadRootId: request.id,
          entry: {
            id: "unrelated-thinking",
            type: "thinking",
            text: "Unrelated request activity",
            state: "streaming",
            createdAt: "2023-11-14T22:13:25.000Z",
          },
        },
      },
    },
  ];
  const { Story } = defineMeta({
    title: "Community/Agents/Thread context",
    component: CommunityAgentThreadContext,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: consumerSource,
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Completed thinking and tools beside the original request"
  play={async ({ canvas, canvasElement }) => {
    const thinking = await canvas.findByRole("button", { name: /Thinking/ });
    await userEvent.click(thinking);
    await expect(
      await canvas.findByText("Inspecting the README before editing."),
    ).toBeVisible();
    expect(canvasElement.querySelector('[data-streaming="true"]')).toBeNull();
    await expect(canvas.queryByText(response.content)).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("Working through the private owner transcript."),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}<Harness
      ><CommunityAgentThreadContext
        rootId={request.id}
        messageId={request.id}
        roomId="room"
        activity={liveActivity}
        activityContext={{
          kind: "thread",
          channelId: "room",
          threadRootId: request.id,
        }}
        agents={[{ pubkey: agent, name: "Nyra" }]}
      /></Harness
    >{/snippet}
</Story>

<Story
  name="Live owner activity beside its exact request"
  play={async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Read workspace file")).toBeVisible();
    await expect(
      canvas.getByText("Working through the private owner transcript."),
    ).toBeVisible();
    await expect(canvas.getByText("Working on README")).toBeVisible();
    await expect(
      canvas.queryByText("Duplicate public reply"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("Unrelated request activity"),
    ).not.toBeInTheDocument();
    expect(
      canvasElement.querySelector('[data-streaming="true"]'),
    ).not.toBeNull();
  }}
>
  {#snippet template()}<Harness eventsOverride={[request]}
      ><CommunityAgentThreadContext
        rootId={request.id}
        messageId={request.id}
        roomId="room"
        activity={liveActivity}
        activityContext={{
          kind: "thread",
          channelId: "room",
          threadRootId: request.id,
        }}
        agents={[{ pubkey: agent, name: "Nyra" }]}
      /></Harness
    >{/snippet}
</Story>
