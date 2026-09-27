import type { NostrEvent } from "../../protocol/index.js";
import { verifiedCheckpointSnapshot } from "../../projects/checkpoint-conversation.js";
import { retainLiveContext } from "../../projects/repository-live-context.js";

/** Verify and merge one relay delivery batch before publishing reactive state. */
export function mergeConversationEvents(
  current: readonly NostrEvent[],
  incoming: readonly NostrEvent[],
): readonly NostrEvent[] {
  let next: NostrEvent[] | undefined;
  const knownIds = new Set(current.map(({ id }) => id));
  for (const event of incoming) {
    if (knownIds.has(event.id)) continue;
    const signed = verifiedCheckpointSnapshot(event);
    if (!signed) continue;
    next ??= [...current];
    knownIds.add(signed.id);
    if (signed.kind === 23908)
      next = [
        ...next.filter((item) => item.kind !== 23908),
        ...retainLiveContext(
          next.filter((item) => item.kind === 23908),
          signed,
        ),
      ];
    else next.push(signed);
  }
  return next ?? current;
}

export async function mergeConversationEventPage(
  current: readonly NostrEvent[],
  incoming: readonly NostrEvent[],
  options: {
    batchSize?: number;
    cancelled?: () => boolean;
    yieldTask?: () => Promise<void>;
  } = {},
): Promise<readonly NostrEvent[]> {
  const batchSize = Math.max(1, options.batchSize ?? 24);
  const yieldTask =
    options.yieldTask ??
    (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  let next = current;
  for (let offset = 0; offset < incoming.length; offset += batchSize) {
    if (options.cancelled?.()) return current;
    next = mergeConversationEvents(
      next,
      incoming.slice(offset, offset + batchSize),
    );
    if (offset + batchSize < incoming.length) await yieldTask();
  }
  return next;
}
