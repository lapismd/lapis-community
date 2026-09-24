<script lang="ts">
  import CommunityAgentTranscript from "../components/community-agent-activity/CommunityAgentTranscript.svelte";
  import CommunityAgentThreadContext from "../components/community-agent-thread-context/CommunityAgentThreadContext.svelte";
  import { provideAgentConversation } from "../components/community-agent-conversation/context.svelte.js";
  import { transcriptCommentFixture } from "./transcript-comment-fixture.js";
  import { repositoryContextTurns } from "../components/community-projects/repository-context-transcript.js";
  import { buildRepositoryAgentContexts } from "../projects/repository-agent-context.js";
  import type { ProjectForgeSession } from "../projects/data-source.js";
  import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
  import { Button } from "@lapismd/design-core/shadcn/button";
  let {
    live = false,
    failFirst = false,
    onPublish,
    onOpen,
  }: {
    live?: boolean;
    failFirst?: boolean;
    onPublish?: (template: NostrEventTemplate) => void;
    onOpen?: (room: string, root: string, reply?: string) => void;
  } = $props();
  const f = transcriptCommentFixture();
  let receive: (event: NostrEvent) => void = () => {};
  let visible = $state(true),
    published = $state(0),
    opened = $state("");
  let attempted = false;
  const session = {
    queryHttp: async () => (live ? [f.root] : f.events),
    subscribe: async (
      _filters: unknown,
      next: (item: { event: NostrEvent }) => void,
    ) => {
      receive = (event) => next({ event });
      return () => {};
    },
    publish: async (template: NostrEventTemplate) => {
      if (failFirst && !attempted) {
        attempted = true;
        throw new Error("Persistence unavailable. Retry this comment.");
      }
      onPublish?.(template);
      published++;
      return f.sign(template);
    },
  } as unknown as ProjectForgeSession;
  const conversation = provideAgentConversation({
    session: () => session,
    memberId: () => f.owner,
    members: () => [
      { id: f.owner, name: "Operator", handle: "operator", initials: "OP" },
      {
        id: f.agent,
        name: "Nyra",
        handle: "nyra",
        initials: "NY",
        isAgent: true,
      },
    ],
    rooms: () => [
      {
        id: "general",
        groupId: "general",
        name: "general",
        kind: "channel",
        unreadCount: 0,
      },
    ],
    openThread: (room, root, reply) => {
      opened = root;
      onOpen?.(room, root, reply);
    },
  });
  $effect(() => conversation.watch("general"));
  const activity = $derived(
    live
      ? f.records.map((record) => ({
          id: record.id,
          agentPubkey: f.agent,
          createdAt: record.sequence,
          frame: {
            version: 2 as const,
            seq: record.sequence,
            sessionId: "thread",
            turnId: "turn",
            channelId: "general",
            timestamp: new Date(record.created_at_ms).toISOString(),
            kind: "transcript_record",
            payload: {
              scopeKey: `scope/thread/${f.root.id}`,
              capture: {
                schema: "lapis.transcript-fragment/1",
                recordId: record.id,
                index: 0,
                count: 1,
                data: record.text,
              },
            },
          },
        }))
      : repositoryContextTurns(buildRepositoryAgentContexts(f.events)).flatMap(
          (turn) => turn.segments.flatMap((segment) => segment.activity),
        ),
  );
</script>

<Button onclick={() => (visible = !visible)}>Toggle transcript</Button>
{#if live}<Button onclick={() => f.events.forEach(receive)}
    >Persist checkpoint</Button
  >{/if}
{#if visible}<CommunityAgentTranscript
    {activity}
    agent={{ pubkey: f.agent, name: "Nyra" }}
    members={conversation.members}
  />{/if}
<section aria-label="Original conversation">
  <CommunityAgentThreadContext
    messageId={f.root.id}
    rootId={f.root.id}
    roomId="general"
  />
</section>
<output aria-label="Published comments">{published}</output>
{#if opened}<p role="status">Opened original conversation</p>{/if}
