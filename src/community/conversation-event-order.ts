import type { NostrEvent } from "../protocol/index.js";
import { compareOldest } from "./materialize-shared.js";

/** Preserve causal and logical message order when Nostr timestamps share a second. */
export function orderConversationEvents(
  events: readonly NostrEvent[],
): NostrEvent[] {
  const ordered = [
    ...new Map(events.map((event) => [event.id, event])).values(),
  ].sort(compareOldest);
  const byId = new Map(ordered.map((event) => [event.id, event]));
  const dependencies = new Map<string, Set<string>>();
  const batches = new Map<
    string,
    Array<{ event: NostrEvent; sequence: number }>
  >();
  for (const event of ordered) {
    const parents = new Set(
      event.tags.flatMap(([key, id, , marker]) =>
        id &&
        (key === "E" ||
          (key === "e" &&
            (!marker || marker === "root" || marker === "reply"))) &&
        byId.get(id)?.created_at === event.created_at
          ? [id]
          : [],
      ),
    );
    dependencies.set(event.id, parents);
    const identities = event.tags.filter(([key]) => key === "d");
    const match =
      identities.length === 1 &&
      /^(.*):([a-f0-9]{64}):(\d+):assistant_message$/u.exec(
        identities[0]![1] ?? "",
      );
    if (
      !match ||
      !Number.isSafeInteger(Number(match[3])) ||
      !event.tags.some(([key, id]) => key === "e" && id === match[2])
    )
      continue;
    const batch = JSON.stringify([
      event.pubkey,
      event.created_at,
      match[1],
      match[2],
    ]);
    const entries = batches.get(batch) ?? [];
    entries.push({ event, sequence: Number(match[3]) });
    batches.set(batch, entries);
  }
  for (const entries of batches.values()) {
    entries.sort(
      (a, b) => a.sequence - b.sequence || a.event.id.localeCompare(b.event.id),
    );
    for (let index = 1; index < entries.length; index++)
      dependencies
        .get(entries[index]!.event.id)!
        .add(entries[index - 1]!.event.id);
  }
  // Iterative traversal handles long threads. Cycles retain every event in a
  // deterministic order without allowing malformed references to hang rendering.
  const visiting = new Set<string>(),
    emitted = new Set<string>(),
    result: NostrEvent[] = [];
  for (const event of ordered) {
    const stack = [{ id: event.id, exit: false }];
    while (stack.length) {
      const current = stack.pop()!;
      if (emitted.has(current.id)) continue;
      if (current.exit) {
        visiting.delete(current.id);
        emitted.add(current.id);
        result.push(byId.get(current.id)!);
      } else if (!visiting.has(current.id)) {
        visiting.add(current.id);
        stack.push({ ...current, exit: true });
        for (const id of [...dependencies.get(current.id)!].sort().reverse())
          if (id !== current.id && !visiting.has(id))
            stack.push({ id, exit: false });
      }
    }
  }
  return result;
}
