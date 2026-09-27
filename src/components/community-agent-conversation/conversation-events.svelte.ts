import { CheckpointConversationIndex } from "../../projects/checkpoint-conversation.js";
import { resolveTranscriptComment } from "../../projects/transcript-comments.js";
import type { ProjectForgeSession } from "../../projects/data-source.js";
import type { NostrEvent } from "../../protocol/index.js";
import { visibleEvents } from "./model.js";
import {
  mergeConversationEventPage,
  mergeConversationEvents,
} from "./conversation-event-merge.js";
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
  let deliveryQueue = Promise.resolve();
  function receive(event: NostrEvent) {
    const next = mergeConversationEvents(events, [event]);
    if (next !== events) events = [...next];
  }
  function receiveMany(items: readonly NostrEvent[], signal: AbortSignal) {
    const work = deliveryQueue.then(async () => {
      if (signal.aborted || items.length === 0) return;
      const base = events;
      const next = await mergeConversationEventPage(base, items, {
        cancelled: () => signal.aborted,
      });
      if (signal.aborted || next === base) return;
      if (events === base) events = [...next];
      else {
        const prior = new Set(base.map(({ id }) => id));
        const additions = next.filter(({ id }) => !prior.has(id));
        const merged = mergeConversationEvents(events, additions);
        if (merged !== events) events = [...merged];
      }
    });
    deliveryQueue = work.catch(() => undefined);
    return work;
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
      .then((items) => receiveMany(items, abort.signal))
      .catch((cause) => {
        if (!abort.signal.aborted) error = String(cause);
      })
      .finally(() => {
        if (!abort.signal.aborted) loading = false;
      });
    let stop: (() => void) | undefined,
      replaying = true,
      flushScheduled = false;
    const buffered: NostrEvent[] = [];
    const flush = () => {
      flushScheduled = false;
      const items = buffered.splice(0);
      if (!abort.signal.aborted) void receiveMany(items, abort.signal);
    };
    const scheduleFlush = () => {
      if (flushScheduled) return;
      flushScheduled = true;
      queueMicrotask(flush);
    };
    void session
      .subscribe(
        [...filters, { kinds: [23908], "#h": ids }],
        (item) => {
          if (abort.signal.aborted) return;
          if (item.event) buffered.push(item.event);
          if (item.type === "eose") {
            replaying = false;
            flush();
          } else if (!replaying && item.event) scheduleFlush();
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
  const reviewIndex = $derived(new CheckpointConversationIndex(events));
  const checkpoints = $derived(reviewIndex.checkpoints);
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
