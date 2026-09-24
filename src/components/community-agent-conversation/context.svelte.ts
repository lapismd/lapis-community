import { createTranscriptCommentDrafts } from "./transcript-comment-drafts.svelte.js";
import { resolveCheckpointReview } from "../../projects/checkpoint-reviews.js";
import { getContext, setContext } from "svelte";
import { createConversationEvents } from "./conversation-events.svelte.js";
import type { ProjectForgeSession } from "../../projects/data-source.js";
import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../../community/workspace-model.js";
import { discussionEdit, discussionDeletion } from "./message-actions.js";
import { conversationMessage, eventTag, eventRoot } from "./model.js";

const key = Symbol("agent-conversation");
export function provideAgentConversation(owner: {
  session(): ProjectForgeSession | undefined;
  memberId(): string | undefined;
  members(): readonly CommunityMemberModel[];
  rooms(): readonly CommunityRoomModel[];
  openThread(roomId: string, root: string, reply?: string): void;
}) {
  let replyCommentId = $state<string>();
  const stream = createConversationEvents(owner.session);
  const events = $derived(stream.all);
  const receive = stream.receive;
  async function publish(template: NostrEventTemplate) {
    if (!owner.memberId() || !owner.session())
      throw new Error("Sign in to participate");
    const event = await owner.session()!.publish(template);
    receive(event);
    return event;
  }
  const api = {
    transcriptDrafts: createTranscriptCommentDrafts(),
    get reviewIndex() {
      return stream.reviewIndex;
    },
    get transcriptComments() {
      return stream.transcriptComments;
    },
    get events() {
      return stream.visible;
    },
    get checkpoints() {
      return stream.checkpoints;
    },
    get loading() {
      return stream.loading;
    },
    get error() {
      return stream.error;
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
    watch: stream.watch,
    message(id: string) {
      const event = api.events.find((event) => event.id === id);
      return event
        ? conversationMessage(event, events, owner.memberId())
        : undefined;
    },
    async loadMessage(id: string) {
      const cached = api.message(id);
      if (cached) return cached;
      const matches = await owner.session()?.queryHttp([{ ids: [id] }]);
      matches?.filter((event) => event.id === id).forEach(receive);
      return api.message(id);
    },
    publish,
    isDeleted: (event: Pick<NostrEvent, "id" | "pubkey">) =>
      events.some(
        (item) =>
          item.kind === 5 &&
          item.pubkey === event.pubkey &&
          item.tags.some(([key, id]) => key === "e" && id === event.id),
      ),
    edit: (event: NostrEvent, content: string) =>
      publish(discussionEdit(event, owner.memberId(), content)),
    delete: (event: NostrEvent) =>
      publish(discussionDeletion(event, owner.memberId())),
    async commitDescription(repository: string, sha: string) {
      const response = await owner.session()?.loadCommit(repository, sha);
      return response
        ? [response.commit.subject, response.commit.body]
            .filter(Boolean)
            .join("\n\n")
        : undefined;
    },
    get replyCommentId() {
      return replyCommentId;
    },
    clearCommentReply() {
      replyCommentId = undefined;
    },
    openComment(event: NostrEvent) {
      const target = resolveCheckpointReview(event, api.reviewIndex);
      const room = owner
        .rooms()
        .find(
          (room) => (room.groupId ?? room.id) === target?.checkpoint.channelId,
        );
      const root = target?.rootId;
      if (room && root) {
        replyCommentId = event.id;
        owner.openThread(room.id, root, event.id);
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
      replyCommentId = undefined;
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
