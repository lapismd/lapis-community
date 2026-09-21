<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";
  import CommunityAgentComposerActivity from "./CommunityAgentComposerActivity.svelte";
  import {
    storyAgent,
    storyAgentState,
    storyAgentRooms,
  } from "../community-agents/story-fixtures.js";
  import {
    playFailureComposerActivity,
    playLatestComposerActivity,
    playMultipleComposerActivity,
    playPermissionComposerActivity,
    playThreadScopedComposerActivity,
  } from "./composer-activity-story.js";
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

<Story name="Latest update" play={playLatestComposerActivity} />
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
  play={playMultipleComposerActivity}
/>
<Story
  name="Permission"
  args={{
    model: storyAgentState({
      conversationScopes: { a: { ...scope, state: "waiting_permission" } },
    }),
  }}
  play={playPermissionComposerActivity}
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
          preview:
            "This request was interrupted by a controller restart and was not automatically retried.",
        },
      },
    }),
  }}
  play={playFailureComposerActivity}
>
  {#snippet template(args)}<div style="width: 16rem; max-width: 100%;">
      <CommunityAgentComposerActivity {...args} />
    </div>{/snippet}
</Story>
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
  play={playThreadScopedComposerActivity}
/>
<Story name="Dark" parameters={{ backgrounds: { default: "dark" } }} />
