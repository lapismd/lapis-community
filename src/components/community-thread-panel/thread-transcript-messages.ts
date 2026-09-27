import { orderConversationEvents } from "../../community/conversation-event-order.js";
import type { CommunityMessageModel } from "../../community/workspace-model.js";
import type { AgentConversation } from "../community-agent-conversation/context.svelte.js";
/** Merge only validated transcript feedback, without changing ordinary message order. */
export function threadTranscriptMessages(
  messages: readonly CommunityMessageModel[],
  conversation:
    | Pick<AgentConversation, "transcriptComments" | "message">
    | undefined,
  rootId: string,
  channelId?: string,
) {
  // Raw transcript comments can arrive through the room subscription before
  // their verified conversation projection is ready. Hide them immediately so
  // they cannot flash as ordinary messages and then disappear after hydration.
  const ordinaryMessages = messages.filter(
    (message) =>
      !(
        message.sourceEvent?.kind === 1111 &&
        message.sourceEvent.tags.some(
          ([key, value]) =>
            key === "record" || (key === "t" && value === "transcript-comment"),
        )
      ),
  );
  if (!conversation) return ordinaryMessages;
  const additions = conversation.transcriptComments.filter(
    ({ target }) =>
      target.rootId === rootId && target.checkpoint.channelId === channelId,
  );
  // Kind-1111 transcript candidates must come through the verified, visible
  // projection even if a room subscription also supplied them as messages.
  const byId = new Map(
    ordinaryMessages.map((message) => [message.id, message]),
  );
  for (const { event } of additions) {
    const message = conversation.message(event.id);
    if (message) byId.set(message.id, message);
  }
  const ranks = new Map(
    orderConversationEvents(
      [...byId.values()].flatMap((message) =>
        message.sourceEvent ? [message.sourceEvent] : [],
      ),
    ).map((event, index) => [event.id, index]),
  );
  return [...byId.values()].sort((a, b) => {
    if (a.id === rootId) return -1;
    if (b.id === rootId) return 1;
    if (ranks.has(a.id) && ranks.has(b.id))
      return ranks.get(a.id)! - ranks.get(b.id)!;
    return (
      (Date.parse(a.createdAt ?? "") || 0) -
      (Date.parse(b.createdAt ?? "") || 0)
    );
  });
}
