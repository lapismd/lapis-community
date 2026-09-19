import type { NostrEvent } from "../protocol/index.js";
import type { CommunityRelay } from "../nostr/index.js";
import {
  buzzWorkItemFilters,
  KIND_JJ_AGENT_CONTEXT_PAGE,
  KIND_JJ_CHECKPOINT_MANIFEST,
} from "./work-item-filters.js";
import { parseJsonRecord } from "./repository-agent-context-parsing.js";

/** Resolve referenced context pages even when they predate the initial relay window. */
export async function repositoryWorkItemBundles(
  relay: Pick<CommunityRelay, "query">,
  repository: NostrEvent,
  signal?: AbortSignal,
) {
  const identifier = repository.tags.find((tag) => tag[0] === "d")?.[1];
  if (repository.kind !== 30617 || !identifier)
    throw new Error("Work items require a kind 30617 repository event");
  const coordinate = `${repository.kind}:${repository.pubkey}:${identifier}`;
  const bundles = await Promise.all(
    buzzWorkItemFilters(coordinate).map((filter) =>
      relay.query(filter, signal),
    ),
  );
  const present = new Set(bundles.flat().map((event) => event.id));
  const missing = [
    ...new Set(
      bundles
        .flat()
        .filter((event) => event.kind === KIND_JJ_CHECKPOINT_MANIFEST)
        .flatMap((event) => {
          const ids = parseJsonRecord(event.content).page_event_ids;
          return Array.isArray(ids)
            ? ids.filter(
                (id): id is string =>
                  typeof id === "string" &&
                  /^[a-f0-9]{64}$/u.test(id) &&
                  !present.has(id),
              )
            : [];
        }),
    ),
  ].slice(0, 4096);
  for (let offset = 0; offset < missing.length; offset += 200)
    bundles.push(
      await relay.query(
        {
          kinds: [KIND_JJ_AGENT_CONTEXT_PAGE],
          ids: missing.slice(offset, offset + 200),
          "#a": [coordinate],
        },
        signal,
      ),
    );
  return bundles;
}
