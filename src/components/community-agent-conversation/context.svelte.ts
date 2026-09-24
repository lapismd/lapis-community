import { createConversationNavigation } from "./conversation-navigation.svelte.js";
import { createConversationReaction } from "./conversation-reactions.js";
import { provideTranscriptNavigation } from "./transcript-navigation.js";
import { toggleTranscriptReaction } from "../../projects/transcript-reactions.js";
import type { TranscriptCommentAnchor } from "../../protocol/transcript-comment-anchor.js";
import { createTranscriptReplies } from "./transcript-replies.svelte.js";
import { getContext, setContext } from "svelte";
import { createConversationEvents } from "./conversation-events.svelte.js";
import type { ProjectForgeSession } from "../../projects/data-source.js";
import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../../community/workspace-model.js";
import { discussionEdit, discussionDeletion } from "./message-actions.js";
import { conversationMessage } from "./model.js";

const key = Symbol("agent-conversation");
export function provideAgentConversation(owner: {
  session(): ProjectForgeSession | undefined;
  memberId(): string | undefined;
  members(): readonly CommunityMemberModel[];
  rooms(): readonly CommunityRoomModel[];
  openThread(roomId: string, root: string, reply?: string): void;
}) {
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
  const replies = createTranscriptReplies({
    ...owner,
    index: () => stream.reviewIndex,
    receive,
    publish,
  });
  const navigation = createConversationNavigation(
    owner,
    replies,
    () => stream.reviewIndex,
  );
  const api = {
    replies,
    get transcriptDrafts() {
      return replies.drafts;
    },
    get replyCommentId() {
      return navigation.replyCommentId;
    },
    clearCommentReply() {
      navigation.clearCommentReply();
    },
    openComment(event: NostrEvent) {
      navigation.openComment(event);
    },
    open(event: NostrEvent, reply = true) {
      navigation.open(event, reply);
    },
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
    reactToTranscript(
      anchor: TranscriptCommentAnchor,
      emoji: string,
      custom?: { shortcode: string; url: string },
    ) {
      return publish(
        toggleTranscriptReaction(
          api.reviewIndex,
          anchor,
          owner.memberId() ?? "",
          emoji,
          custom,
        ),
      );
    },
    react: createConversationReaction({
      events: () => stream.visible,
      memberId: owner.memberId,
      publish,
    }),
  };
  provideTranscriptNavigation({
    session: owner.session,
    index: () => stream.reviewIndex,
    receive,
    channel: (id) =>
      owner.rooms().find((room) => room.id === id)?.groupId ??
      owner.rooms().find((room) => room.id === id)?.id,
    replies,
  });
  setContext(key, api);
  return api;
}
export type AgentConversation = ReturnType<typeof provideAgentConversation>;
export const useAgentConversation = () =>
  getContext<AgentConversation | undefined>(key);
