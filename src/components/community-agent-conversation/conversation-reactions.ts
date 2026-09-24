import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import { eventTag } from "./model.js";
export function createConversationReaction(owner: {
  events(): readonly NostrEvent[];
  memberId(): string | undefined;
  publish(template: NostrEventTemplate): Promise<NostrEvent>;
}) {
  return async function react(event: NostrEvent, emoji: string) {
    const channel = eventTag(event, "h");
    if (!channel) return;
    const previous = owner
      .events()
      .filter(
        (item) =>
          item.kind === 7 &&
          item.pubkey === owner.memberId() &&
          item.content === emoji &&
          item.tags.some(([key, value]) => key === "e" && value === event.id),
      );
    await owner.publish({
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
  };
}
