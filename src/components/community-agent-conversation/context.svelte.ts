import { getContext, setContext } from "svelte";
import { verifyEvent } from "nostr-tools/pure";
import type { ProjectForgeSession } from "../../projects/data-source.js";
import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../../community/workspace-model.js";
import { buildRepositoryAgentContexts } from "../../projects/repository-agent-context.js";
import { retainLiveContext } from "../../projects/repository-live-context.js";
import {
  conversationMessage,
  eventTag,
  eventRoot,
  visibleEvents,
} from "./model.js";

const key = Symbol("agent-conversation");
export function provideAgentConversation(owner: {
  session(): ProjectForgeSession | undefined;
  memberId(): string | undefined;
  members(): readonly CommunityMemberModel[];
  rooms(): readonly CommunityRoomModel[];
  openThread(roomId: string, root: string, reply?: string): void;
}) {
  let events = $state.raw<NostrEvent[]>([]);
  let channels = $state.raw<string[]>([]);
  let loading = $state(false);
  let error = $state("");
  let replyCommentId = $state<string>();
  const watchers = new Map<string, number>();
  function receive(event: NostrEvent) {
    if (!verifyEvent(event)) return;
    events =
      event.kind === 23908
        ? [
            ...events.filter((item) => item.kind !== 23908),
            ...retainLiveContext(
              events.filter((item) => item.kind === 23908),
              event,
            ),
          ]
        : [...events.filter((item) => item.id !== event.id), event];
  }
  $effect(() => {
    const session = owner.session(),
      ids = channels;
    error = "";
    if (!session || !ids.length) {
      loading = false;
      if (!session) events = [];
      return;
    }
    const abort = new AbortController();
    const filters = [
      { kinds: [1, 5, 7, 9, 11, 1111, 3907, 3908], "#h": ids, limit: 2000 },
    ];
    loading = true;
    void session
      .queryHttp(filters, abort.signal)
      .then((items) => {
        if (!abort.signal.aborted) items.forEach(receive);
      })
      .catch((cause) => {
        if (!abort.signal.aborted) error = String(cause);
      })
      .finally(() => {
        if (!abort.signal.aborted) loading = false;
      });
    let stop: (() => void) | undefined;
    void session
      .subscribe(
        [...filters, { kinds: [23908], "#h": ids }],
        (item) => {
          if (!abort.signal.aborted && item.event) receive(item.event);
        },
        abort.signal,
      )
      .then((dispose) => {
        if (abort.signal.aborted) dispose();
        else stop = dispose;
      })
      .catch(() => {});
    return () => {
      abort.abort();
      stop?.();
    };
  });
  async function publish(template: NostrEventTemplate) {
    if (!owner.memberId() || !owner.session())
      throw new Error("Sign in to participate");
    const event = await owner.session()!.publish(template);
    receive(event);
    return event;
  }
  const api = {
    get events() {
      return visibleEvents(events);
    },
    get checkpoints() {
      return buildRepositoryAgentContexts(events);
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get memberId() {
      return owner.memberId();
    },
    get members() {
      return owner.members();
    },
    get rooms() {
      return owner.rooms();
    },
    watch(channel: string) {
      const first = !watchers.has(channel);
      watchers.set(channel, (watchers.get(channel) ?? 0) + 1);
      if (first) channels = [...watchers.keys()];
      return () => {
        const count = (watchers.get(channel) ?? 1) - 1;
        if (count) watchers.set(channel, count);
        else {
          watchers.delete(channel);
          channels = [...watchers.keys()];
        }
      };
    },
    message(id: string) {
      const event = api.events.find((event) => event.id === id);
      return event
        ? conversationMessage(event, events, owner.memberId())
        : undefined;
    },
    publish,
    get replyCommentId() {
      return replyCommentId;
    },
    clearCommentReply() {
      replyCommentId = undefined;
    },
    openComment(event: NostrEvent) {
      const room = owner
        .rooms()
        .find((room) => (room.groupId ?? room.id) === eventTag(event, "h"));
      const root = eventTag(event, "thread");
      if (room && root) {
        replyCommentId = event.id;
        owner.openThread(room.id, root);
      }
    },
    async react(event: NostrEvent, emoji: string) {
      const channel = eventTag(event, "h");
      if (!channel) return;
      const previous = api.events.filter(
        (item) =>
          item.kind === 7 &&
          item.pubkey === owner.memberId() &&
          item.content === emoji &&
          item.tags.some(([key, value]) => key === "e" && value === event.id),
      );
      await publish({
        kind: previous.length ? 5 : 7,
        created_at: Math.floor(Date.now() / 1000),
        content: previous.length ? "" : emoji,
        tags: previous.length
          ? [
              ["h", channel],
              ...previous.map((item) => ["e", item.id]),
              ["k", "7"],
            ]
          : [
              ["h", channel],
              ["e", event.id],
              ["p", event.pubkey],
              ["k", String(event.kind)],
            ],
      });
    },
    open(event: NostrEvent, reply = true) {
      const room = owner
        .rooms()
        .find((room) => (room.groupId ?? room.id) === eventTag(event, "h"));
      if (room)
        owner.openThread(
          room.id,
          eventRoot(event),
          reply ? event.id : undefined,
        );
    },
  };
  setContext(key, api);
  return api;
}
export type AgentConversation = ReturnType<typeof provideAgentConversation>;
export const useAgentConversation = () =>
  getContext<AgentConversation | undefined>(key);
