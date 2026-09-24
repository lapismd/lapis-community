<script lang="ts">
  import { createTranscriptComment } from "../projects/transcript-comments.js";
  import { untrack } from "svelte";
  import CommunityAgentTranscript from "../components/community-agent-activity/CommunityAgentTranscript.svelte";
  import CommunityAgentThreadContext from "../components/community-agent-thread-context/CommunityAgentThreadContext.svelte";
  import CommunityThreadPanel from "../components/community-thread-panel/CommunityThreadPanel.svelte";
  import { conversationMessage } from "../components/community-agent-conversation/model.js";
  import { provideAgentConversation } from "../components/community-agent-conversation/context.svelte.js";
  import { nativeTranscriptCommentFixture } from "./native-transcript-comment-fixture.js";
  import { transcriptCommentFixture } from "./transcript-comment-fixture.js";
  import { groupedTranscriptCommentFixture } from "./grouped-transcript-comment-fixture.js";
  import { richTranscriptToolFixture } from "./rich-transcript-tool-fixture.js";
  import { repositoryContextTurns } from "../components/community-projects/repository-context-transcript.js";
  import { buildRepositoryAgentContexts } from "../projects/repository-agent-context.js";
  import type { ProjectForgeSession } from "../projects/data-source.js";
  import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
  import { Button } from "@lapismd/design-core/shadcn/button";
  let {
    native = false,
    live = false,
    failFirst = false,
    onPublish,
    onOpen,
    threadPanel = false,
    grouped = false,
    richTools = false,
    initialComment = false,
    switchViewer = false,
  }: {
    native?: boolean;
    live?: boolean;
    failFirst?: boolean;
    onPublish?: (template: NostrEventTemplate) => void;
    onOpen?: (room: string, root: string, reply?: string) => void;
    threadPanel?: boolean;
    grouped?: boolean;
    richTools?: boolean;
    initialComment?: boolean;
    switchViewer?: boolean;
  } = $props();
  const f = untrack(() =>
    native
      ? nativeTranscriptCommentFixture()
      : grouped
        ? groupedTranscriptCommentFixture()
        : richTools
          ? richTranscriptToolFixture()
          : transcriptCommentFixture(),
  );
  if (untrack(() => initialComment))
    f.events.push(
      f.sign(
        createTranscriptComment(
          f.events,
          { checkpointEventId: f.checkpoint.id, recordId: "record-2" },
          "Check the patent terms.",
        ),
      ),
    );
  let viewer = $state(f.owner);
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
    memberId: () => viewer,
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
{#if switchViewer}<Button
    onclick={() => (viewer = viewer === f.owner ? f.agent : f.owner)}
    >Switch viewer</Button
  >{/if}
{#if live}<Button onclick={() => f.events.forEach(receive)}
    >Persist checkpoint</Button
  >{/if}
{#if visible}<CommunityAgentTranscript
    {activity}
    agent={{ pubkey: f.agent, name: "Nyra" }}
    members={conversation.members}
  />{/if}
<section aria-label="Original conversation">
  {#if threadPanel}
    <CommunityThreadPanel
      thread={{
        rootMessageId: f.root.id,
        messages: [conversationMessage(f.root, f.events, f.owner)],
      }}
      members={[...conversation.members]}
      rooms={conversation.rooms}
      currentMemberId={viewer}
    />
  {:else}
    <CommunityAgentThreadContext
      messageId={f.root.id}
      rootId={f.root.id}
      roomId="general"
    />
  {/if}
</section>
<output aria-label="Published comments">{published}</output>
{#if opened}<p role="status">Opened original conversation</p>{/if}
