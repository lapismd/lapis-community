<script lang="ts">
  import type {
    CommunityComposerSubmission,
    CommunityMemberModel,
    CommunityPulseAgentIdentity,
    CommunityPulseModel,
    CommunityPulseNoteModel,
    CommunityPulseTab,
  } from "../index.js";
  import CommunityPulse from "./CommunityPulse.svelte";

  let {
    initialTab = "everyone",
    feedState = "ready",
    agentDirectory = "present",
    anonymous = false,
  }: {
    initialTab?: CommunityPulseTab;
    feedState?: "ready" | "loading" | "empty" | "error";
    agentDirectory?: "present" | "empty" | "absent";
    anonymous?: boolean;
  } = $props();

  const steve: CommunityMemberModel = {
    id: "1".repeat(64),
    name: "Steve",
    handle: "@steve",
    initials: "SJ",
    presence: "online",
    status: "Building calmer community tools",
  };
  const ava: CommunityMemberModel = {
    id: "2".repeat(64),
    name: "Ava Chen",
    handle: "@ava",
    initials: "AC",
    presence: "online",
    status: "Designing in public",
  };
  const noor: CommunityMemberModel = {
    id: "3".repeat(64),
    name: "Noor",
    handle: "@noor-agent",
    initials: "NO",
    presence: "online",
    status: "Projection checks complete",
  };
  const agents = $derived.by(
    (): readonly CommunityPulseAgentIdentity[] | undefined =>
      agentDirectory === "absent"
        ? undefined
        : agentDirectory === "empty"
          ? []
          : [
              {
                pubkey: noor.id,
                name: "Noor Automations",
                status: "Projection checks complete",
              },
            ],
  );

  let tab = $state<CommunityPulseTab>("everyone");
  let initialized = $state(false);
  let lastAction = $state("ready");
  let noteSequence = $state(0);
  let notes = $state.raw<CommunityPulseNoteModel[]>([
    createNote({
      id: "a".repeat(64),
      author: ava,
      content:
        "The new **Pulse** view keeps public notes close to the community without turning them into another room.",
      createdAt: 1_700_000_060,
      likeCount: 4,
      likedByCurrentUser: true,
      parent: {
        id: "f".repeat(64),
        author: steve,
        content: "What should a calm public feed feel like?",
      },
    }),
    createNote({
      id: "b".repeat(64),
      author: noor,
      content: "I finished checking the latest deterministic relay projection.",
      createdAt: 1_700_000_050,
      likeCount: 2,
    }),
    createNote({
      id: "c".repeat(64),
      author: noor,
      content: "All replay checks are green and the summary is ready.",
      createdAt: 1_700_000_020,
      likeCount: 0,
    }),
    createNote({
      id: "d".repeat(64),
      author: steve,
      content: "Building a calmer place for communities to work in public.",
      createdAt: 1_699_999_980,
      likeCount: 7,
      currentUserOwns: true,
    }),
  ]);

  $effect(() => {
    if (initialized) return;
    tab = initialTab;
    initialized = true;
  });

  const visibleNotes = $derived.by(() => {
    if (feedState === "empty" || feedState === "loading") return [];
    if (tab === "following") return notes.filter((note) => note.author === ava);
    if (tab === "liked") return notes.filter((note) => note.likedByCurrentUser);
    if (tab === "agents") return notes.filter((note) => note.author === noor);
    if (tab === "mine") return notes.filter((note) => note.currentUserOwns);
    return notes;
  });
  const model = $derived<CommunityPulseModel>({
    tab,
    status:
      feedState === "loading"
        ? "loading"
        : feedState === "error"
          ? "error"
          : "ready",
    notes: visibleNotes,
    agentActivities:
      tab === "agents" && visibleNotes.length > 0
        ? [
            {
              id: `${noor.id}:1700000020`,
              agent: agents?.[0] ?? {
                pubkey: noor.id,
                name: "Noor Automations",
              },
              notes: visibleNotes,
            },
          ]
        : [],
    members: [steve, ava, noor],
    ...(agents === undefined ? {} : { agents }),
    canDirectMessage: true,
    lastUpdatedAt: 1_700_000_100,
    ...(feedState === "error"
      ? { error: "The relay paused this Pulse request." }
      : {}),
  });

  function createNote(input: {
    id: string;
    author: CommunityMemberModel;
    content: string;
    createdAt: number;
    likeCount: number;
    likedByCurrentUser?: boolean;
    currentUserOwns?: boolean;
    parent?: CommunityPulseNoteModel["parent"];
  }): CommunityPulseNoteModel {
    const { parent, likedByCurrentUser, currentUserOwns, ...required } = input;
    return {
      ...required,
      sourceEvent: {
        id: input.id,
        pubkey: input.author.id,
        created_at: input.createdAt,
        kind: 1,
        tags: [],
        content: input.content,
        sig: "0".repeat(128),
      },
      mentionPubkeys: [],
      likedByCurrentUser: likedByCurrentUser ?? false,
      currentUserOwns: currentUserOwns ?? false,
      ...(parent === undefined ? {} : { parent }),
    };
  }

  function publish(
    submission: CommunityComposerSubmission,
    replyToEventId?: string,
  ): void {
    noteSequence += 1;
    const parent = notes.find((note) => note.id === replyToEventId);
    notes = [
      createNote({
        id: noteSequence.toString(16).padStart(64, "e"),
        author: steve,
        content: submission.content,
        createdAt: 1_700_000_100 + noteSequence,
        likeCount: 0,
        currentUserOwns: true,
        ...(parent === undefined
          ? {}
          : {
              parent: {
                id: parent.id,
                author: parent.author,
                content: parent.content,
              },
            }),
      }),
      ...notes,
    ];
    lastAction = replyToEventId ? `replied:${replyToEventId}` : "published";
  }

  function toggleLike(eventId: string): void {
    notes = notes.map((note) =>
      note.id === eventId
        ? {
            ...note,
            likedByCurrentUser: !note.likedByCurrentUser,
            likeCount: Math.max(
              0,
              note.likeCount + (note.likedByCurrentUser ? -1 : 1),
            ),
          }
        : note,
    );
    lastAction = `liked:${eventId}`;
  }
</script>

<div
  data-testid="community-pulse-story"
  data-last-action={lastAction}
  style="min-height: 42rem; background: var(--background);"
>
  <CommunityPulse
    {model}
    {...anonymous ? {} : { currentMember: steve }}
    rooms={[{ id: "general", name: "general", kind: "channel" }]}
    onSelectTab={(nextTab) => {
      tab = nextTab;
      lastAction = `tab:${nextTab}`;
    }}
    onPublish={publish}
    onToggleLike={toggleLike}
    onShare={(eventId) => {
      lastAction = `shared:${eventId}`;
    }}
    onOpenProfile={(member) => {
      lastAction = `profile:${member.id}`;
    }}
    onMessageMember={(member) => {
      lastAction = `dm:${member.id}`;
    }}
    onRetry={() => {
      lastAction = "retried";
    }}
  />
  <span class="sr-only" aria-live="polite">{lastAction}</span>
</div>
