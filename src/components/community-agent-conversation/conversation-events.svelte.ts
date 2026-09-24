import {
  verifiedCheckpointSnapshot,
  CheckpointConversationIndex,
} from "../../projects/checkpoint-conversation.js";
import { resolveTranscriptComment } from "../../projects/transcript-comments.js";
import type { ProjectForgeSession } from "../../projects/data-source.js";
import type { NostrEvent } from "../../protocol/index.js";
import { buildRepositoryAgentContexts } from "../../projects/repository-agent-context.js";
import { retainLiveContext } from "../../projects/repository-live-context.js";
import { visibleEvents } from "./model.js";
/** Subscription, signature checks and cached read models share application ownership. */
export function createConversationEvents(
  sessionOwner: () => ProjectForgeSession | undefined,
) {
  let channels = $state.raw<string[]>([]);
  // Reference counts are lifecycle bookkeeping; only the channel list is reactive.
  const watchers = new Map<string, number>();
  function watch(channel: string) {
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
  }
  let events = $state.raw<NostrEvent[]>([]);
  let loading = $state(false);
  let error = $state("");
  function receive(event: NostrEvent) {
    const signed = verifiedCheckpointSnapshot(event);
    if (!signed) return;
    event = signed;
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
    const session = sessionOwner(),
      ids = [...channels];
    error = "";
    if (!session || !ids.length) {
      loading = false;
      if (!session) events = [];
      return;
    }
    const abort = new AbortController();
    const filters = [
      {
        kinds: [1, 5, 7, 9, 11, 1111, 40003, 3907, 3908],
        "#h": ids,
        limit: 2000,
      },
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
  const visible = $derived(visibleEvents(events));
  const checkpoints = $derived(buildRepositoryAgentContexts(events));
  const reviewIndex = $derived(new CheckpointConversationIndex(events));
  const transcriptComments = $derived(
    visible.flatMap((event) => {
      const target = resolveTranscriptComment(event, reviewIndex);
      return target ? [{ event, target }] : [];
    }),
  );
  return {
    watch,
    get reviewIndex() {
      return reviewIndex;
    },
    get transcriptComments() {
      return transcriptComments;
    },
    receive,
    get all() {
      return events;
    },
    get visible() {
      return visible;
    },
    get checkpoints() {
      return checkpoints;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
  };
}
