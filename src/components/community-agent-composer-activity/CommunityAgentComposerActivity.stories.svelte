<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityAgentComposerActivity from "./CommunityAgentComposerActivity.svelte";
  import {
    storyAgent,
    storyAgentState,
    storyAgentRooms,
  } from "../community-agents/story-fixtures.js";
  const scope = {
    agentPubkey: storyAgent.pubkey,
    scopeKey: "general/thread/a",
    channelId: "general",
    threadRootId: "a",
    conversationKind: "thread" as const,
    active: true,
    state: "running",
    preview: "Running tests",
    updatedAt: Date.now(),
  };
  const { Story } = defineMeta({
    title: "Community/Agents/Composer activity",
    component: CommunityAgentComposerActivity,
    tags: ["visual-pending"],
    args: {
      context: { kind: "channel", channelId: "general" },
      rooms: storyAgentRooms,
      onOpen: fn(),
      model: storyAgentState({ conversationScopes: { a: scope } }),
    },
    parameters: {
      docs: {
        source: {
          code: '<CommunityAgentComposerActivity {model} context={{kind: "channel", channelId}} onOpen={openAgentActivity} />',
        },
      },
    },
  });
</script>

<Story
  name="Latest update"
  play={async ({ canvas, args }) => {
    await expect(canvas.getByText("Research: Running tests")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "View Research activity" }),
    );
    await expect(args.onOpen).toHaveBeenCalledWith(storyAgent.pubkey, {
      kind: "thread",
      channelId: "general",
      threadRootId: "a",
    });
  }}
/>
<Story
  name="Multiple conversations"
  args={{
    model: storyAgentState({
      conversationScopes: {
        a: scope,
        b: {
          ...scope,
          scopeKey: "b",
          threadRootId: "b",
          preview: "Reviewing changes",
        },
      },
    }),
  }}
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "View working agents" }),
    );
    await expect(
      within(canvasElement.ownerDocument.body).getByText("Reviewing changes", {
        exact: true,
      }),
    ).toBeVisible();
  }}
/>
<Story
  name="Permission"
  args={{
    model: storyAgentState({
      conversationScopes: { a: { ...scope, state: "waiting_permission" } },
    }),
  }}
/>
<Story
  name="Failure"
  args={{
    model: storyAgentState({
      conversationScopes: {
        a: {
          ...scope,
          active: false,
          state: "failed",
          severity: "error",
          preview: "Model unavailable",
        },
      },
    }),
  }}
/>
<Story
  name="Long output"
  args={{
    model: storyAgentState({
      conversationScopes: {
        a: {
          ...scope,
          preview:
            "Reviewing the channel history and checking the latest changes before responding to your request with a useful summary.",
        },
      },
    }),
  }}
/>
<Story name="Idle" args={{ model: storyAgentState() }} />
<Story
  name="Thread scoped"
  args={{
    context: { kind: "thread", channelId: "general", threadRootId: "b" },
  }}
  play={async ({ canvas }) => {
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  }}
/>
<Story name="Dark" parameters={{ backgrounds: { default: "dark" } }} />
