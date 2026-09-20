import type {
  CommunityMessageModel,
  CommunityThreadModel,
} from "./workspace-model.js";

/** Immediate reply targets remain distinct from the conversation's canonical root. */
export function projectThread(
  messages: readonly CommunityMessageModel[],
  rootMessageId: string | undefined,
): CommunityThreadModel | undefined {
  if (!rootMessageId) return;
  return {
    rootMessageId,
    messages: messages.filter(
      (message) =>
        message.id === rootMessageId ||
        message.parentMessageId === rootMessageId ||
        message.sourceEvent?.tags.some(
          ([key, id, , marker]) =>
            key === "e" && marker === "root" && id === rootMessageId,
        ),
    ),
  };
}
