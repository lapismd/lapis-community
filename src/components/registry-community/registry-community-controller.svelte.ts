import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";

import {
  authenticateRegistryRelay,
  Nip07RegistrySigner,
  type RegistrySigner,
} from "../../auth/index.js";
import {
  createRegistryCommunityDataSource,
  type RegistryCommunityDataSource,
} from "../../community/index.js";
import {
  createWebSocketCommunityRelayFactory,
  type CommunityRelay,
  type RelayCountResult,
} from "../../nostr/index.js";
import {
  NIP29_KINDS,
  createNip29ForumCommentTemplate,
  createNip29ForumThreadTemplate,
  LAPIS_GROUPS,
  lapisGroupId,
  lapisPluginSupportGroupId,
  type NostrEvent,
} from "../../protocol/index.js";

import {
  anyRelayPublished,
  displayName,
  isValidNativeEmojiReaction,
  latestReactionByAuthor,
  materializeNip29Forum,
  materializeNip29Reactions,
  parseProfiles,
  parseRelayUrls,
  relayPublishFailureMessage,
  reactionGroups,
  selectRelayCount,
  seekTimestampForCount,
  timelineTimestamp,
  type CommunityProfile,
  type ForumPost,
  type ForumReaction,
} from "./model.js";
import {
  advanceRegistryDiscussionTopicCursor,
  emptyRegistryDiscussionPreferences,
  markRegistryDiscussionTopicUnread,
  readRegistryDiscussionPreferences,
  registryDiscussionPreferenceKey,
  writeRegistryDiscussionPreferences,
  type RegistryDiscussionPreferences,
} from "./registry-discussion-preferences.js";
import {
  DiscussionPaginationError,
  adjacentDiscussionWindow,
  centeredDiscussionWindow,
  completeNewestBoundedSlice,
  mergeDiscussionPosts,
  sliceBoundaryWindow,
  type DiscussionLoadDirection,
  type DiscussionWindowRange,
} from "../discussion-post-stream/discussion-stream.js";
import {
  readRegistryDiscussionCursor,
  registryDiscussionReadKey,
  writeRegistryDiscussionCursor,
  type RegistryDiscussionReadCursor,
} from "./registry-discussion-read-state.js";
import type { CommunityApplicationAuthenticationContext } from "../community-application/authentication-context.js";

export interface RegistryCommunityProps {
  plugin?: string;
  name?: string;
  version?: string;
  releaseEventId?: string;
  publisher?: string;
  relays?: string;
}

export interface RegistryCommunityControllerOptions
  extends RegistryCommunityProps {
  dataSource?: RegistryCommunityDataSource;
  identity?: RegistrySigner;
}

export interface RegistrySuggestedTopic {
  post: ForumPost;
  title: string;
  author: string;
  activityTimestamp: number;
  replyCount?: number;
  replyCountApproximate?: boolean;
  unread: boolean;
  isNew: boolean;
}

export function createRegistryCommunityController(
  options: RegistryCommunityControllerOptions,
  applicationAuthentication?: CommunityApplicationAuthenticationContext,
) {
  const plugin = options.plugin ?? "";
  const name = options.name ?? "Plugin";
  const publisher = options.publisher ?? "";
  const relays = options.relays ?? "[]";

  let allReviews = $state<ForumPost[]>([]);
  let reactions = $state<ForumReaction[]>([]);
  let pluginRelease = $state<NostrEvent | undefined>();
  let pluginReactions = $state<ForumReaction[]>([]);
  let releaseEventId = $state(options.releaseEventId ?? "");
  let pluginCommunityGeneration = 0;
  let profiles = $state<ReadonlyMap<string, CommunityProfile>>(new Map());
  let signer = $state<RegistrySigner | undefined>(options.identity);
  let signedInPubkey = $state("");
  let selectedPluginReaction = $state("");
  let comment = $state("");
  let replyingTo = $state("");
  let activePostId = $state("");
  let lastReadCursor = $state<RegistryDiscussionReadCursor | undefined>();
  let lastReadIndex = $state<number | undefined>();
  let commentTotal = $state(0);
  let commentTotalApproximate = $state(false);
  let commentCountAvailable = $state(false);
  let commentHasPrevious = $state(false);
  let commentHasNext = $state(false);
  let pageStartIndex = $state(0);
  let pageEndIndex = $state(0);
  let visibleReviewIds = $state<ReadonlySet<string>>(new Set());
  let threadFirstTimestamp = $state(0);
  let threadLastTimestamp = $state(0);
  let loading = $state(true);
  let summaryLoading = $state(false);
  let loadingPrevious = $state(false);
  let loadingNext = $state(false);
  let loadingJump = $state(false);
  let previousError = $state("");
  let nextError = $state("");
  let publishing = $state(false);
  let message = $state("");
  let error = $state("");
  let commentError = $state("");
  let preferences = $state<RegistryDiscussionPreferences>(
    emptyRegistryDiscussionPreferences(),
  );
  let preferencesStorageKey = "";
  let suggestedTopics = $state<RegistrySuggestedTopic[]>([]);
  let suggestionsLoading = $state(false);
  let suggestionsLoaded = false;
  let suggestionsRootEventId = "";
  let suggestionsController: AbortController | undefined;
  let scrollTargetPostId = $state("");
  let scrollRevision = $state(0);
  let loadSequence = 0;
  let streamGeneration = 0;
  let jumpController: AbortController | undefined;
  let summaryController: AbortController | undefined;
  let pluginCommunityLoaded = false;
  let discussionInitialized = false;
  let pluginCommunityPromise:
    | Promise<Awaited<ReturnType<typeof loadPluginCommunity>>>
    | undefined;
  let commentCountPromise:
    | Promise<RelayCountResult & { availableRelays: number }>
    | undefined;
  let identityRevision = 0;

  const dataSource =
    options.dataSource ??
    createRegistryCommunityDataSource({
      relayFactory: createWebSocketCommunityRelayFactory(),
    });
  const readSecretKey = generateSecretKey();
  const readPubkey = getPublicKey(readSecretKey);
  const readSigner: RegistrySigner = {
    getPublicKey: async () => readPubkey,
    signEvent: async (template) => finalizeEvent(template, readSecretKey),
  };
  const commentPageSize = 20;
  const boundaryBucketLimit = 1_000;
  const parentContextLimit = 80;
  const parentContextDepth = 12;
  const relayAuthentication = new WeakMap<
    CommunityRelay,
    { signer: RegistrySigner; promise: Promise<void> }
  >();
  const countProbeCache = new Map<number, number>();
  const commentWindowCache = new Map<string, LoadedCommentWindow>();
  const countProbeCacheLimit = 128;
  const commentWindowCacheLimit = 12;

  const relayUrls = $derived(parseRelayUrls(relays));
  const supportGroupId = $derived(
    plugin === "" ? "" : lapisPluginSupportGroupId(plugin),
  );
  const readStateKey = $derived(
    registryDiscussionReadKey(relayUrls, supportGroupId, signedInPubkey),
  );
  const preferenceKey = $derived(
    registryDiscussionPreferenceKey(relayUrls, supportGroupId, signedInPubkey),
  );
  const releaseGroupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);
  const reviews = $derived(
    allReviews.filter((entry) => visibleReviewIds.has(entry.event.id)),
  );
  const currentPluginReactions = $derived(
    pluginRelease === undefined
      ? []
      : latestReactionByAuthor(pluginReactions, pluginRelease.id),
  );
  const pluginReactionSummary = $derived(
    pluginRelease === undefined
      ? []
      : reactionGroups(pluginRelease.id, currentPluginReactions),
  );
  const ownPluginReaction = $derived(
    currentPluginReactions.find(
      (reaction) => reaction.event.pubkey === signedInPubkey,
    ),
  );
  const replyingReview = $derived(
    reviews.find((review) => review.event.id === replyingTo),
  );
  const activePostIndex = $derived.by(() => {
    const index = reviews.findIndex(
      (review) => review.event.id === activePostId,
    );
    return index === -1 ? 0 : index;
  });
  const activeGlobalPostIndex = $derived(
    commentTotal === 0 ? 0 : pageStartIndex + activePostIndex,
  );
  const activePostTimestamp = $derived.by(() => {
    const localIndex = activeGlobalPostIndex - pageStartIndex;
    return (
      reviews[localIndex]?.event.created_at ??
      timelineTimestamp(
        activeGlobalPostIndex,
        commentTotal,
        threadFirstTimestamp,
        threadLastTimestamp,
      )
    );
  });
  const activeRootEventId = $derived.by(() => {
    const active = allReviews.find((post) => post.event.id === activePostId);
    return active?.rootEventId ?? reviews.at(-1)?.rootEventId ?? "";
  });
  const activeTopicPreference = $derived(preferences.topics[activeRootEventId]);
  const unreadPostCount = $derived.by(() => {
    if (!preferences.followed || activeRootEventId === "") return 0;
    const cursor = activeTopicPreference?.readCursor;
    const later = allReviews.filter(
      (post) =>
        post.rootEventId === activeRootEventId &&
        (cursor === undefined ||
          post.event.created_at > cursor.createdAt ||
          (post.event.created_at === cursor.createdAt &&
            post.event.id.localeCompare(cursor.eventId) > 0)),
    ).length;
    return Math.max(activeTopicPreference?.forcedUnread ? 1 : 0, later);
  });
  const hasPrevious = $derived(commentHasPrevious);
  const hasNext = $derived(commentHasNext);
  const displayedPostStart = $derived(
    reviews.length === 0 ? 0 : pageStartIndex + 1,
  );
  const displayedPostEnd = $derived(reviews.length === 0 ? 0 : pageEndIndex);
  const participantCount = $derived.by(
    () =>
      new Set([
        ...reviews.map((review) => review.event.pubkey),
        ...reactions.map((reaction) => reaction.event.pubkey),
        ...currentPluginReactions.map((reaction) => reaction.event.pubkey),
      ]).size,
  );

  function relay(url: string): CommunityRelay {
    return dataSource.relay(url);
  }

  async function authenticateRelay(
    client: CommunityRelay,
    activeSigner: RegistrySigner,
    signal?: AbortSignal,
  ): Promise<void> {
    const cached = relayAuthentication.get(client);
    if (cached?.signer === activeSigner) {
      await cached.promise;
      return;
    }
    const promise = authenticateRegistryRelay(
      client,
      activeSigner,
      signal,
    ).then(() => undefined);
    relayAuthentication.set(client, { signer: activeSigner, promise });
    try {
      await promise;
    } catch (cause) {
      if (relayAuthentication.get(client)?.promise === promise) {
        relayAuthentication.delete(client);
      }
      throw cause;
    }
  }

  async function queryAll(
    filter: Parameters<CommunityRelay["query"]>[0],
    signal?: AbortSignal,
  ): Promise<{ events: NostrEvent[]; availableRelays: number }> {
    signal?.throwIfAborted();
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        const client = relay(url);
        await authenticateRelay(client, signer ?? readSigner, signal);
        return await client.query(filter, signal);
      }),
    );
    signal?.throwIfAborted();
    const successful = results.filter(
      (result): result is PromiseFulfilledResult<NostrEvent[]> =>
        result.status === "fulfilled",
    );
    const events = new Map(
      successful
        .flatMap((result) => result.value)
        .map((event) => [event.id, event] as const),
    );
    const ordered = [...events.values()].toSorted(compareEvents);
    return {
      events:
        filter.limit === undefined
          ? ordered
          : ordered.slice(-Math.max(0, filter.limit)),
      availableRelays: successful.length,
    };
  }

  async function countAll(
    filter: Parameters<CommunityRelay["query"]>[0],
    signal?: AbortSignal,
  ): Promise<RelayCountResult & { availableRelays: number }> {
    signal?.throwIfAborted();
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        const client = relay(url);
        await authenticateRelay(client, signer ?? readSigner, signal);
        if (client.countMany !== undefined) {
          return await client.countMany([filter], signal);
        }
        if (client.count !== undefined) {
          return {
            count: await client.count(filter, signal),
            approximate: false,
          };
        }
        throw new Error(`${client.url}: relay does not support NIP-45 counts`);
      }),
    );
    signal?.throwIfAborted();
    const counts = results
      .filter(
        (result): result is PromiseFulfilledResult<RelayCountResult> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
    const selected = selectRelayCount(counts);
    return {
      count: selected?.count ?? 0,
      approximate: selected?.approximate ?? false,
      ...(selected?.hyperLogLog === undefined
        ? {}
        : { hyperLogLog: selected.hyperLogLog }),
      availableRelays: counts.length,
    };
  }

  function compareEvents(left: NostrEvent, right: NostrEvent): number {
    return (
      left.created_at - right.created_at || left.id.localeCompare(right.id)
    );
  }

  function parentIds(events: readonly NostrEvent[]): string[] {
    return events
      .map((event) => event.tags.find((tag) => tag[0] === "e")?.[1])
      .filter((id): id is string => id !== undefined && id.length === 64);
  }

  async function loadParentContext(
    pageEvents: readonly NostrEvent[],
    signal?: AbortSignal,
  ): Promise<NostrEvent[]> {
    const context = new Map(
      pageEvents.map((event) => [event.id, event] as const),
    );
    let frontier = parentIds(pageEvents).filter((id) => !context.has(id));
    for (
      let depth = 0;
      depth < parentContextDepth &&
      frontier.length > 0 &&
      context.size < pageEvents.length + parentContextLimit;
      depth += 1
    ) {
      const remaining = pageEvents.length + parentContextLimit - context.size;
      const result = await queryAll(
        {
          kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
          ids: frontier.slice(0, remaining),
          "#h": [supportGroupId],
          limit: Math.min(frontier.length, remaining),
        },
        signal,
      );
      const added = result.events.filter((event) => !context.has(event.id));
      for (const event of added) context.set(event.id, event);
      frontier = parentIds(added).filter((id) => !context.has(id));
    }
    return [...context.values()];
  }

  interface LoadedCommentWindow {
    events: NostrEvent[];
    visibleIds: ReadonlySet<string>;
    total: number;
    startIndex: number;
    endIndex: number;
    targetIndex: number;
    firstTimestamp: number;
    lastTimestamp: number;
    availableRelays: number;
    countAvailable?: boolean;
    totalApproximate?: boolean;
    hasPrevious?: boolean;
    hasNext?: boolean;
  }

  interface HydratedCommentWindow {
    posts: ForumPost[];
    reactions: ForumReaction[];
    profiles: CommunityProfile[];
  }

  function cacheCountProbe(timestamp: number, count: number): void {
    countProbeCache.delete(timestamp);
    countProbeCache.set(timestamp, count);
    while (countProbeCache.size > countProbeCacheLimit) {
      const oldest = countProbeCache.keys().next().value;
      if (oldest === undefined) break;
      countProbeCache.delete(oldest);
    }
  }

  function countSeekBounds(
    targetCount: number,
    latestTimestamp: number,
    totalCount: number,
  ):
    | {
        lowerTimestamp: number;
        upperTimestamp: number;
        upperCount: number;
      }
    | undefined {
    let lowerTimestamp = 0;
    let upperTimestamp = latestTimestamp;
    let upperCount = totalCount;
    let narrowed = false;
    for (const [timestamp, count] of countProbeCache) {
      if (timestamp < 0 || timestamp > latestTimestamp) continue;
      if (count < targetCount && timestamp + 1 > lowerTimestamp) {
        lowerTimestamp = timestamp + 1;
        narrowed = true;
      }
      if (count >= targetCount && timestamp < upperTimestamp) {
        upperTimestamp = timestamp;
        upperCount = count;
        narrowed = true;
      }
    }
    return narrowed && lowerTimestamp <= upperTimestamp
      ? { lowerTimestamp, upperTimestamp, upperCount }
      : undefined;
  }

  async function seekCommentTimestamp(
    targetCount: number,
    latestTimestamp: number,
    totalCount: number,
    baseFilter: Parameters<CommunityRelay["query"]>[0],
    signal?: AbortSignal,
  ) {
    return seekTimestampForCount(
      targetCount,
      latestTimestamp,
      totalCount,
      async (until) => {
        const cached = countProbeCache.get(until);
        if (cached !== undefined) {
          cacheCountProbe(until, cached);
          return cached;
        }
        const result = await countAll({ ...baseFilter, until }, signal);
        if (result.availableRelays === 0 || result.approximate) {
          throw new Error(
            "The community relay stopped providing exact NIP-45 counts.",
          );
        }
        cacheCountProbe(until, result.count);
        return result.count;
      },
      countSeekBounds(targetCount, latestTimestamp, totalCount),
    );
  }

  function commentWindowCacheKey(window: LoadedCommentWindow): string {
    return `${window.total}:${window.startIndex}:${window.endIndex}`;
  }

  function cacheCommentWindow(window: LoadedCommentWindow): void {
    const key = commentWindowCacheKey(window);
    commentWindowCache.delete(key);
    commentWindowCache.set(key, window);
    while (commentWindowCache.size > commentWindowCacheLimit) {
      const oldest = commentWindowCache.keys().next().value;
      if (oldest === undefined) break;
      commentWindowCache.delete(oldest);
    }
  }

  function cachedCommentWindow(
    targetIndex: number,
  ): LoadedCommentWindow | undefined {
    for (const [key, window] of [...commentWindowCache].reverse()) {
      if (
        window.total === commentTotal &&
        targetIndex >= window.startIndex &&
        targetIndex < window.endIndex
      ) {
        commentWindowCache.delete(key);
        commentWindowCache.set(key, window);
        return { ...window, targetIndex };
      }
    }
    return undefined;
  }

  async function loadCompleteNewestSlice(
    baseFilter: Parameters<CommunityRelay["query"]>[0],
    until: number,
    size: number,
    probeForOlder: boolean,
    signal?: AbortSignal,
  ): Promise<{
    events: NostrEvent[];
    availableRelays: number;
    hasOlder: boolean;
  }> {
    if (size <= 0) {
      return { events: [], availableRelays: 0, hasOlder: false };
    }
    const result = await queryAll(
      {
        ...baseFilter,
        until,
        limit: size + (probeForOlder ? 1 : 0),
      },
      signal,
    );
    const newestCandidates = result.events.toSorted(compareEvents);
    const oldestCandidate = newestCandidates[0];
    if (oldestCandidate === undefined) {
      return {
        events: [],
        availableRelays: result.availableRelays,
        hasOlder: false,
      };
    }
    const boundaryResult = await queryAll(
      {
        ...baseFilter,
        since: oldestCandidate.created_at,
        until: oldestCandidate.created_at,
        limit: boundaryBucketLimit + 1,
      },
      signal,
    );
    if (boundaryResult.events.length > boundaryBucketLimit) {
      throw new DiscussionPaginationError(
        `More than ${boundaryBucketLimit} posts share one relay timestamp. Narrow pagination cannot be proven safely.`,
      );
    }
    const completed = completeNewestBoundedSlice({
      requestedEvents: result.events,
      boundaryEvents: boundaryResult.events,
      size,
      eventId: (event) => event.id,
      createdAt: (event) => event.created_at,
      compare: compareEvents,
    });
    return {
      events: completed.events,
      availableRelays: Math.max(
        result.availableRelays,
        boundaryResult.availableRelays,
      ),
      hasOlder: completed.hasOlder,
    };
  }

  async function loadPreviousCommentWindow(
    baseFilter: Parameters<CommunityRelay["query"]>[0],
    currentRange: DiscussionWindowRange,
    signal?: AbortSignal,
  ): Promise<LoadedCommentWindow | undefined> {
    const cursor = reviews[0]?.event;
    const exactCount = commentCountAvailable && !commentTotalApproximate;
    if (cursor === undefined || (exactCount && currentRange.startIndex <= 0))
      return undefined;
    const page = exactCount
      ? adjacentDiscussionWindow(
          commentTotal,
          currentRange.startIndex,
          currentRange.endIndex,
          "prepend",
          commentPageSize,
        )
      : {
          startIndex: Math.max(0, currentRange.startIndex - commentPageSize),
          endIndex: currentRange.startIndex,
          targetIndex: Math.max(0, currentRange.startIndex - 1),
        };
    const expected = exactCount
      ? page.endIndex - page.startIndex
      : commentPageSize;
    const boundaryResult = await queryAll(
      {
        ...baseFilter,
        since: cursor.created_at,
        until: cursor.created_at,
        limit: boundaryBucketLimit + 1,
      },
      signal,
    );
    if (boundaryResult.events.length > boundaryBucketLimit) {
      throw new DiscussionPaginationError(
        `More than ${boundaryBucketLimit} posts share one relay timestamp. Narrow pagination cannot be proven safely.`,
      );
    }
    const boundaryEvents = boundaryResult.events
      .filter((event) => compareEvents(event, cursor) < 0)
      .toSorted(compareEvents);
    const olderNeeded = Math.max(0, expected - boundaryEvents.length);
    const olderResult =
      olderNeeded === 0
        ? {
            events: [],
            availableRelays: boundaryResult.availableRelays,
            hasOlder: false,
          }
        : await loadCompleteNewestSlice(
            baseFilter,
            cursor.created_at - 1,
            olderNeeded,
            !exactCount,
            signal,
          );
    const candidates = [...olderResult.events, ...boundaryEvents].toSorted(
      compareEvents,
    );
    const pageEvents = candidates.slice(-expected);
    if (exactCount && pageEvents.length !== expected) {
      throw new DiscussionPaginationError(
        "The relay could not provide the complete previous discussion window. Retry the request.",
      );
    }
    const events = await loadParentContext(pageEvents, signal);
    return {
      events,
      visibleIds: new Set(pageEvents.map((event) => event.id)),
      total: commentTotal,
      ...page,
      firstTimestamp:
        page.startIndex === 0
          ? (pageEvents[0]?.created_at ?? threadFirstTimestamp)
          : threadFirstTimestamp,
      lastTimestamp:
        threadLastTimestamp || reviews.at(-1)?.event.created_at || 0,
      availableRelays: Math.max(
        boundaryResult.availableRelays,
        olderResult.availableRelays,
      ),
      countAvailable: commentCountAvailable,
      totalApproximate: commentTotalApproximate,
      hasPrevious: exactCount
        ? page.startIndex > 0
        : olderResult.hasOlder || candidates.length > expected,
      hasNext: commentHasNext,
    };
  }

  async function loadInitialNewestCommentWindow(
    baseFilter: Parameters<CommunityRelay["query"]>[0],
    newestResult: { events: NostrEvent[]; availableRelays: number },
    signal?: AbortSignal,
  ): Promise<LoadedCommentWindow> {
    const newestCandidates = newestResult.events.toSorted(compareEvents);
    const oldestCandidate = newestCandidates[0];
    const latestEvent = newestCandidates.at(-1);
    if (oldestCandidate === undefined || latestEvent === undefined) {
      return {
        events: [],
        visibleIds: new Set(),
        total: 0,
        startIndex: 0,
        endIndex: 0,
        targetIndex: 0,
        firstTimestamp: 0,
        lastTimestamp: 0,
        availableRelays: newestResult.availableRelays,
        countAvailable: false,
        totalApproximate: false,
        hasPrevious: false,
        hasNext: false,
      };
    }
    const boundaryResult = await queryAll(
      {
        ...baseFilter,
        since: oldestCandidate.created_at,
        until: oldestCandidate.created_at,
        limit: boundaryBucketLimit + 1,
      },
      signal,
    );
    if (boundaryResult.events.length > boundaryBucketLimit) {
      throw new DiscussionPaginationError(
        `More than ${boundaryBucketLimit} posts share one relay timestamp. Narrow pagination cannot be proven safely.`,
      );
    }
    const candidates = [
      ...newestCandidates.filter(
        (event) => event.created_at > oldestCandidate.created_at,
      ),
      ...boundaryResult.events,
    ].toSorted(compareEvents);
    const hasPrevious = candidates.length > commentPageSize;
    const pageEvents = candidates.slice(-commentPageSize);
    const events = await loadParentContext(pageEvents, signal);
    const provisionalTotal = pageEvents.length + (hasPrevious ? 1 : 0);
    return {
      events,
      visibleIds: new Set(pageEvents.map((event) => event.id)),
      total: provisionalTotal,
      startIndex: provisionalTotal - pageEvents.length,
      endIndex: provisionalTotal,
      targetIndex: Math.max(0, provisionalTotal - 1),
      firstTimestamp: hasPrevious ? 0 : (pageEvents[0]?.created_at ?? 0),
      lastTimestamp: latestEvent.created_at,
      availableRelays: Math.max(
        newestResult.availableRelays,
        boundaryResult.availableRelays,
      ),
      countAvailable: false,
      totalApproximate: false,
      hasPrevious,
      hasNext: false,
    };
  }

  async function loadNewestCommentWindow(
    baseFilter: Parameters<CommunityRelay["query"]>[0],
    countResult: { count: number; availableRelays: number },
    newestResult: { events: NostrEvent[]; availableRelays: number },
    signal?: AbortSignal,
  ): Promise<LoadedCommentWindow> {
    const newestCandidates = newestResult.events.toSorted(compareEvents);
    const oldestCandidate = newestCandidates[0];
    const latestEvent = newestCandidates.at(-1);
    if (
      countResult.count === 0 ||
      oldestCandidate === undefined ||
      latestEvent === undefined
    ) {
      return {
        events: [],
        visibleIds: new Set(),
        total: 0,
        startIndex: 0,
        endIndex: 0,
        targetIndex: 0,
        firstTimestamp: 0,
        lastTimestamp: 0,
        availableRelays: Math.max(
          countResult.availableRelays,
          newestResult.availableRelays,
        ),
      };
    }

    const [beforeBoundary, throughBoundary] = await Promise.all([
      countAll(
        { ...baseFilter, until: oldestCandidate.created_at - 1 },
        signal,
      ),
      countAll({ ...baseFilter, until: oldestCandidate.created_at }, signal),
    ]);
    if (beforeBoundary.approximate || throughBoundary.approximate) {
      throw new DiscussionPaginationError(
        "The community relay did not provide the exact counts required to prove the newest discussion boundary.",
      );
    }
    cacheCountProbe(oldestCandidate.created_at - 1, beforeBoundary.count);
    cacheCountProbe(oldestCandidate.created_at, throughBoundary.count);
    const boundaryCount = throughBoundary.count - beforeBoundary.count;
    if (boundaryCount <= 0 || boundaryCount > boundaryBucketLimit) {
      throw new DiscussionPaginationError(
        boundaryCount > boundaryBucketLimit
          ? `More than ${boundaryBucketLimit} posts share one relay timestamp. Narrow pagination cannot be proven safely.`
          : "The relay count index changed while the newest discussion window was loading. Retry the request.",
      );
    }
    const boundaryResult = await queryAll(
      {
        ...baseFilter,
        since: oldestCandidate.created_at,
        until: oldestCandidate.created_at,
        limit: boundaryCount,
      },
      signal,
    );
    if (boundaryResult.events.length !== boundaryCount) {
      throw new DiscussionPaginationError(
        "The relay returned an incomplete same-second event bucket.",
      );
    }

    const pageEvents = [
      ...newestCandidates.filter(
        (event) => event.created_at > oldestCandidate.created_at,
      ),
      ...boundaryResult.events,
    ]
      .toSorted(compareEvents)
      .slice(-Math.min(commentPageSize, countResult.count));
    const expected = Math.min(commentPageSize, countResult.count);
    if (pageEvents.length !== expected) {
      throw new DiscussionPaginationError(
        "The relay returned an incomplete newest discussion window. Retry the request.",
      );
    }
    const events = await loadParentContext(pageEvents, signal);
    const startIndex = countResult.count - pageEvents.length;
    return {
      events,
      visibleIds: new Set(pageEvents.map((event) => event.id)),
      total: countResult.count,
      startIndex,
      endIndex: countResult.count,
      targetIndex: countResult.count - 1,
      firstTimestamp:
        startIndex === 0
          ? (pageEvents[0]?.created_at ?? threadFirstTimestamp)
          : threadFirstTimestamp,
      lastTimestamp: latestEvent.created_at,
      availableRelays: Math.max(
        countResult.availableRelays,
        newestResult.availableRelays,
        boundaryResult.availableRelays,
      ),
    };
  }

  async function loadCommentWindow(
    targetIndex: number,
    direction: DiscussionLoadDirection,
    currentRange: DiscussionWindowRange,
    preferLatest = false,
    signal?: AbortSignal,
  ): Promise<LoadedCommentWindow> {
    const baseFilter = {
      kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
      "#h": [supportGroupId],
    };
    if (direction === "replace" && !preferLatest && commentTotal > 0) {
      const cached = cachedCommentWindow(targetIndex);
      if (cached !== undefined) return cached;
    }
    if (direction === "prepend") {
      const previous = await loadPreviousCommentWindow(
        baseFilter,
        currentRange,
        signal,
      );
      if (previous !== undefined) return previous;
    }
    const [countResult, latestResult] = await Promise.all([
      countAll(baseFilter, signal),
      queryAll(
        { ...baseFilter, limit: preferLatest ? commentPageSize : 1 },
        signal,
      ),
    ]);
    if (countResult.availableRelays === 0) {
      throw new Error("The community relay must support NIP-45 event counts.");
    }
    if (countResult.approximate) {
      throw new DiscussionPaginationError(
        "An exact NIP-45 count is required for timeline navigation.",
      );
    }
    const latestEvent = latestResult.events.toSorted(compareEvents).at(-1);
    if (countResult.count === 0 || latestEvent === undefined) {
      return {
        events: [],
        visibleIds: new Set(),
        total: 0,
        startIndex: 0,
        endIndex: 0,
        targetIndex: 0,
        firstTimestamp: 0,
        lastTimestamp: 0,
        availableRelays: Math.max(
          countResult.availableRelays,
          latestResult.availableRelays,
        ),
      };
    }

    if (direction === "replace" && preferLatest) {
      return loadNewestCommentWindow(
        baseFilter,
        countResult,
        latestResult,
        signal,
      );
    }

    const page =
      direction === "replace"
        ? centeredDiscussionWindow(
            countResult.count,
            targetIndex,
            commentPageSize,
          )
        : adjacentDiscussionWindow(
            countResult.count,
            currentRange.startIndex,
            currentRange.endIndex,
            direction,
            commentPageSize,
          );
    if (page.startIndex === page.endIndex) {
      return {
        events: [],
        visibleIds: new Set(),
        total: countResult.count,
        ...page,
        firstTimestamp: threadFirstTimestamp,
        lastTimestamp: latestEvent.created_at,
        availableRelays: Math.max(
          countResult.availableRelays,
          latestResult.availableRelays,
        ),
      };
    }
    if (commentTotal !== 0 && commentTotal !== countResult.count) {
      countProbeCache.clear();
      commentWindowCache.clear();
    }
    cacheCountProbe(latestEvent.created_at, countResult.count);
    const boundary = await seekCommentTimestamp(
      page.endIndex,
      latestEvent.created_at,
      countResult.count,
      baseFilter,
      signal,
    );
    const countBeforeBoundary =
      boundary.timestamp <= 0
        ? {
            count: 0,
            approximate: false,
            availableRelays: countResult.availableRelays,
          }
        : await countAll(
            { ...baseFilter, until: boundary.timestamp - 1 },
            signal,
          );
    if (countBeforeBoundary.approximate) {
      throw new DiscussionPaginationError(
        "The community relay did not provide the exact counts required for this discussion position.",
      );
    }
    const expectedBoundaryCount = boundary.count - countBeforeBoundary.count;
    cacheCountProbe(boundary.timestamp - 1, countBeforeBoundary.count);
    cacheCountProbe(boundary.timestamp, boundary.count);
    if (
      expectedBoundaryCount <= 0 ||
      expectedBoundaryCount > boundaryBucketLimit
    ) {
      throw new DiscussionPaginationError(
        expectedBoundaryCount > boundaryBucketLimit
          ? `More than ${boundaryBucketLimit} posts share one relay timestamp. Narrow pagination cannot be proven safely.`
          : "The relay count index changed while the discussion window was loading. Retry the request.",
      );
    }
    const boundaryResult = await queryAll(
      {
        ...baseFilter,
        since: boundary.timestamp,
        until: boundary.timestamp,
        limit: expectedBoundaryCount,
      },
      signal,
    );
    if (boundaryResult.availableRelays === 0) {
      throw new Error("The community relay is unavailable. Try again shortly.");
    }
    const olderNeeded = Math.max(
      0,
      countBeforeBoundary.count - page.startIndex,
    );
    const olderResult =
      olderNeeded === 0
        ? {
            events: [],
            availableRelays: boundaryResult.availableRelays,
            hasOlder: false,
          }
        : await loadCompleteNewestSlice(
            baseFilter,
            boundary.timestamp - 1,
            olderNeeded,
            false,
            signal,
          );
    const olderEvents = olderResult.events
      .toSorted(compareEvents)
      .slice(-olderNeeded);
    const pageEvents = sliceBoundaryWindow({
      olderEvents,
      boundaryEvents: boundaryResult.events,
      countBeforeBoundary: countBeforeBoundary.count,
      expectedBoundaryCount,
      range: page,
      eventId: (event) => event.id,
      compare: compareEvents,
    });
    if (pageEvents.length !== page.endIndex - page.startIndex) {
      throw new DiscussionPaginationError(
        "The relay returned an incomplete discussion window. Retry the request.",
      );
    }
    const events = await loadParentContext(pageEvents, signal);
    const firstTimestamp =
      page.startIndex === 0
        ? (pageEvents[0]?.created_at ?? threadFirstTimestamp)
        : threadFirstTimestamp;

    return {
      events,
      visibleIds: new Set(pageEvents.map((event) => event.id)),
      total: countResult.count,
      ...page,
      firstTimestamp,
      lastTimestamp: latestEvent.created_at,
      availableRelays: Math.max(
        countResult.availableRelays,
        boundaryResult.availableRelays,
        olderResult.availableRelays,
      ),
    };
  }

  async function hydrateCommentWindow(
    window: LoadedCommentWindow,
    signal?: AbortSignal,
  ): Promise<HydratedCommentWindow> {
    const visiblePostIds = [...window.visibleIds];
    const reactionEvents =
      visiblePostIds.length === 0
        ? []
        : (
            await queryAll(
              {
                kinds: [NIP29_KINDS.reaction],
                "#e": visiblePostIds,
                limit: Math.min(5_000, visiblePostIds.length * 25),
              },
              signal,
            )
          ).events;
    const posts = materializeNip29Forum(window.events, supportGroupId);
    const nextReactions = materializeNip29Reactions(
      reactionEvents,
      window.visibleIds,
    );
    const authors = [
      ...new Set([
        ...posts.map((post) => post.event.pubkey),
        ...nextReactions.map((reaction) => reaction.event.pubkey),
      ]),
    ].filter((author) => !profiles.has(author));
    const profileEvents =
      authors.length === 0
        ? []
        : (
            await queryAll(
              { kinds: [0], authors, limit: authors.length },
              signal,
            )
          ).events;
    return {
      posts,
      reactions: nextReactions,
      profiles: parseProfiles(profileEvents),
    };
  }

  async function resolveThreadStartTimestamp(
    total: number,
    latestTimestamp: number,
    generation: number,
  ): Promise<void> {
    if (total <= 0 || latestTimestamp <= 0 || threadFirstTimestamp > 0) return;
    const baseFilter = {
      kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
      "#h": [supportGroupId],
    };
    try {
      const boundary = await seekCommentTimestamp(
        1,
        latestTimestamp,
        total,
        baseFilter,
      );
      if (generation === streamGeneration && threadFirstTimestamp === 0) {
        threadFirstTimestamp = boundary.timestamp;
      }
    } catch {
      // The visible newest window remains useful when optional timeline
      // endpoint metadata cannot be resolved.
    }
  }

  async function loadPluginCommunity(signal?: AbortSignal): Promise<{
    release: NostrEvent | undefined;
    reactions: ForumReaction[];
    profiles: CommunityProfile[];
  }> {
    const releaseResult = await queryAll(
      {
        kinds: [NIP29_KINDS.streamMessage],
        ...(releaseEventId === "" ? {} : { ids: [releaseEventId] }),
        "#h": [releaseGroupId],
        "#t": [`plugin:${plugin}`],
        ...(publisher === "" ? {} : { authors: [publisher] }),
        limit: 100,
      },
      signal,
    );
    const release = releaseResult.events.toSorted(compareEvents).at(-1);
    if (release === undefined) return { release, reactions: [], profiles: [] };
    const reactionEvents = (
      await queryAll(
        {
          kinds: [NIP29_KINDS.reaction],
          "#e": [release.id],
          limit: 250,
        },
        signal,
      )
    ).events;
    const nextReactions = materializeNip29Reactions(
      reactionEvents,
      new Set([release.id]),
    ).filter((reaction) => !["✅", "❌", "🚫"].includes(reaction.content));
    const authors = [
      ...new Set([
        release.pubkey,
        ...nextReactions.map((reaction) => reaction.event.pubkey),
      ]),
    ].filter((author) => !profiles.has(author));
    const profileEvents =
      authors.length === 0
        ? []
        : (
            await queryAll(
              { kinds: [0], authors, limit: authors.length },
              signal,
            )
          ).events;
    return {
      release,
      reactions: nextReactions,
      profiles: parseProfiles(profileEvents),
    };
  }

  function ensurePluginCommunity(
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<typeof loadPluginCommunity>>> {
    if (pluginCommunityLoaded) {
      return Promise.resolve({
        release: pluginRelease,
        reactions: pluginReactions,
        profiles: [],
      });
    }
    const generation = pluginCommunityGeneration;
    if (pluginCommunityPromise !== undefined) return pluginCommunityPromise;
    const pending = loadPluginCommunity(signal)
      .then((result) => {
        if (generation !== pluginCommunityGeneration) return result;
        pluginRelease = result.release;
        pluginCommunityLoaded = true;
        pluginReactions = mergeReactions(pluginReactions, result.reactions);
        mergeProfiles(result.profiles);
        return result;
      })
      .finally(() => {
        if (pluginCommunityPromise === pending) {
          pluginCommunityPromise = undefined;
        }
      });
    pluginCommunityPromise = pending;
    return pending;
  }

  async function setReleaseEventId(nextReleaseEventId: string | undefined) {
    const next = nextReleaseEventId ?? "";
    if (next === releaseEventId) return;
    releaseEventId = next;
    pluginCommunityGeneration += 1;
    pluginCommunityPromise = undefined;
    pluginCommunityLoaded = false;
    pluginRelease = undefined;
    pluginReactions = [];
    selectedPluginReaction = "";
    await ensurePluginCommunity();
  }

  function ensureCommentCount(
    signal?: AbortSignal,
  ): Promise<RelayCountResult & { availableRelays: number }> {
    if (commentCountPromise !== undefined) return commentCountPromise;
    const baseFilter = {
      kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
      "#h": [supportGroupId],
    };
    commentCountPromise = countAll(baseFilter, signal)
      .then((result) => {
        if (result.availableRelays > 0) {
          commentCountAvailable = true;
          commentTotalApproximate = result.approximate;
          commentTotal = Math.max(result.count, reviews.length);
        }
        return result;
      })
      .finally(() => {
        commentCountPromise = undefined;
      });
    return commentCountPromise;
  }

  function mergeProfiles(nextProfiles: readonly CommunityProfile[]): void {
    profiles = new Map([
      ...profiles,
      ...nextProfiles.map((profile) => [profile.pubkey, profile] as const),
    ]);
  }

  function mergeReactions(
    current: readonly ForumReaction[],
    incoming: readonly ForumReaction[],
  ): ForumReaction[] {
    return mergeDiscussionPosts(
      current,
      incoming,
      (reaction) => reaction.event.id,
      (left, right) => compareEvents(left.event, right.event),
    );
  }

  function applyCommentWindow(
    window: LoadedCommentWindow,
    hydrated: HydratedCommentWindow,
    direction: DiscussionLoadDirection,
    targetEventId = "",
  ): void {
    cacheCommentWindow(window);
    const incomingVisible = hydrated.posts.filter((post) =>
      window.visibleIds.has(post.event.id),
    );
    allReviews =
      direction === "replace"
        ? hydrated.posts
        : mergeDiscussionPosts(
            allReviews,
            hydrated.posts,
            (post) => post.event.id,
            (left, right) => compareEvents(left.event, right.event),
          );
    visibleReviewIds =
      direction === "replace"
        ? window.visibleIds
        : new Set([...visibleReviewIds, ...window.visibleIds]);
    reactions = mergeReactions(reactions, hydrated.reactions);
    mergeProfiles(hydrated.profiles);
    commentTotal = window.total;
    commentCountAvailable = window.countAvailable ?? true;
    commentTotalApproximate = window.totalApproximate ?? false;
    if (direction === "replace") {
      pageStartIndex = window.startIndex;
      pageEndIndex = window.endIndex;
      commentHasPrevious = window.hasPrevious ?? window.startIndex > 0;
      commentHasNext = window.hasNext ?? window.endIndex < window.total;
    } else if (direction === "prepend") {
      pageStartIndex = window.startIndex;
      commentHasPrevious = window.hasPrevious ?? window.startIndex > 0;
    } else {
      pageEndIndex = window.endIndex;
      commentHasNext = window.hasNext ?? window.endIndex < window.total;
    }
    if (
      direction === "prepend" &&
      (!commentCountAvailable || commentTotalApproximate)
    ) {
      commentTotal = Math.max(
        commentTotal,
        reviews.length + (commentHasPrevious ? 1 : 0),
      );
      pageEndIndex = commentTotal;
      pageStartIndex = Math.max(0, pageEndIndex - reviews.length);
    }
    threadFirstTimestamp = window.firstTimestamp;
    threadLastTimestamp = window.lastTimestamp;

    if (direction === "replace") {
      const targetLocalIndex = Math.max(
        0,
        Math.min(
          window.targetIndex - window.startIndex,
          incomingVisible.length - 1,
        ),
      );
      activePostId =
        incomingVisible.find((post) => post.event.id === targetEventId)?.event
          .id ??
        incomingVisible[targetLocalIndex]?.event.id ??
        incomingVisible[0]?.event.id ??
        "";
    }
  }

  function applyCommentCount(
    result: RelayCountResult & { availableRelays: number },
    generation: number,
  ): void {
    if (
      generation !== streamGeneration ||
      result.availableRelays === 0 ||
      result.count < reviews.length
    ) {
      return;
    }
    const minimumTotal = reviews.length + (commentHasPrevious ? 1 : 0);
    commentCountAvailable = true;
    commentTotalApproximate = result.approximate;
    commentTotal = result.approximate
      ? Math.max(result.count, minimumTotal)
      : result.count;
    pageEndIndex = commentTotal;
    pageStartIndex = Math.max(0, pageEndIndex - reviews.length);
    commentHasPrevious = pageStartIndex > 0;
    commentHasNext = false;
    if (result.approximate) {
      lastReadIndex = undefined;
      threadFirstTimestamp = reviews[0]?.event.created_at ?? 0;
      countProbeCache.clear();
      commentWindowCache.clear();
      return;
    }
    cacheCountProbe(threadLastTimestamp, result.count);
    void resolveThreadStartTimestamp(
      result.count,
      threadLastTimestamp,
      generation,
    );
    void resolveStoredLastReadCursor();
  }

  function requestPostScroll(eventId: string): void {
    activePostId = eventId;
    scrollTargetPostId = eventId;
    scrollRevision += 1;
  }

  function isAbort(cause: unknown): boolean {
    return (
      (cause instanceof DOMException && cause.name === "AbortError") ||
      (cause instanceof Error && cause.name === "AbortError")
    );
  }

  function browserStorage(): Storage | undefined {
    try {
      return typeof window === "undefined" ? undefined : window.localStorage;
    } catch {
      return undefined;
    }
  }

  function loadStoredLastReadCursor(): void {
    const storage = browserStorage();
    lastReadCursor =
      storage === undefined
        ? undefined
        : readRegistryDiscussionCursor(storage, readStateKey);
    lastReadIndex = undefined;
  }

  function loadLocalPreferences(): void {
    if (preferencesStorageKey === preferenceKey) return;
    const storage = browserStorage();
    preferencesStorageKey = preferenceKey;
    preferences =
      storage === undefined
        ? emptyRegistryDiscussionPreferences()
        : readRegistryDiscussionPreferences(storage, preferenceKey);
    suggestionsLoaded = false;
    suggestionsRootEventId = "";
    suggestedTopics = [];
  }

  function persistLocalPreferences(next: RegistryDiscussionPreferences): void {
    if (next === preferences) return;
    preferences = next;
    const storage = browserStorage();
    if (storage !== undefined) {
      writeRegistryDiscussionPreferences(storage, preferenceKey, next);
    }
  }

  function toggleFollow(): void {
    persistLocalPreferences({
      ...preferences,
      followed: !preferences.followed,
    });
  }

  function toggleBookmark(): void {
    persistLocalPreferences({
      ...preferences,
      bookmarked: !preferences.bookmarked,
    });
  }

  function markUnread(): void {
    if (activeRootEventId === "") return;
    persistLocalPreferences(
      markRegistryDiscussionTopicUnread(preferences, activeRootEventId),
    );
  }

  function setComposerHeight(height: number): void {
    if (!Number.isFinite(height)) return;
    persistLocalPreferences({
      ...preferences,
      composerHeight: Math.round(height),
    });
  }

  function recordTopicRead(post: ForumPost): void {
    if (loading || loadingJump) return;
    persistLocalPreferences(
      advanceRegistryDiscussionTopicCursor(preferences, post.rootEventId, {
        eventId: post.event.id,
        createdAt: post.event.created_at,
      }),
    );
  }

  async function resolveStoredLastReadCursor(): Promise<void> {
    const storage = browserStorage();
    if (storage === undefined || supportGroupId === "") return;
    const key = readStateKey;
    const cursor = readRegistryDiscussionCursor(storage, key);
    lastReadCursor = cursor;
    lastReadIndex = undefined;
    if (cursor === undefined) return;
    try {
      const result = await queryAll({
        kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
        ids: [cursor.eventId],
        "#h": [supportGroupId],
        limit: 1,
      });
      if (key !== readStateKey) return;
      const event = result.events.find(
        (candidate) =>
          candidate.id === cursor.eventId &&
          candidate.created_at === cursor.createdAt,
      );
      if (event === undefined) return;
      lastReadIndex = await globalIndexForEvent(event);
    } catch {
      if (key === readStateKey) lastReadIndex = undefined;
    }
  }

  function recordLastRead(eventId: string, globalIndex: number): void {
    if (!commentCountAvailable || commentTotalApproximate) return;
    const storage = browserStorage();
    if (storage === undefined || loading || loadingJump) return;
    const post = reviews.find((review) => review.event.id === eventId);
    if (post === undefined) return;
    const cursor = {
      eventId: post.event.id,
      createdAt: post.event.created_at,
    };
    const current = lastReadCursor;
    if (
      current !== undefined &&
      (current.createdAt > cursor.createdAt ||
        (current.createdAt === cursor.createdAt &&
          current.eventId.localeCompare(cursor.eventId) >= 0))
    ) {
      return;
    }
    if (writeRegistryDiscussionCursor(storage, readStateKey, cursor)) {
      lastReadCursor = cursor;
      lastReadIndex = globalIndex;
    }
  }

  async function refresh(
    targetIndex = activeGlobalPostIndex,
    targetEventId = "",
  ): Promise<boolean> {
    const sequence = ++loadSequence;
    const generation = ++streamGeneration;
    jumpController?.abort();
    const controller = new AbortController();
    jumpController = controller;
    const initialLoad = reviews.length === 0;
    loading = initialLoad;
    loadingJump = !initialLoad;
    error = "";
    previousError = "";
    nextError = "";
    if (relayUrls.length === 0) {
      loading = false;
      loadingJump = false;
      error = "No community relays are configured.";
      return false;
    }
    try {
      const currentRange = {
        startIndex: pageStartIndex,
        endIndex: pageEndIndex,
        targetIndex,
      };
      if (initialLoad && targetEventId === "") {
        const baseFilter = {
          kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
          "#h": [supportGroupId],
        };
        const countPromise = ensureCommentCount(summaryController?.signal);
        const pluginCommunityPromise = ensurePluginCommunity(
          summaryController?.signal,
        );
        const backgroundMetadata = Promise.allSettled([
          pluginCommunityPromise,
          countPromise,
        ]);
        const newestResult = await queryAll(
          { ...baseFilter, limit: commentPageSize + 1 },
          controller.signal,
        );
        const commentWindow = await loadInitialNewestCommentWindow(
          baseFilter,
          newestResult,
          controller.signal,
        );
        const hydration = Promise.allSettled([
          hydrateCommentWindow(commentWindow, controller.signal),
        ]);
        if (sequence !== loadSequence || generation !== streamGeneration)
          return false;
        const resolvedCount = commentCountAvailable
          ? {
              count: commentTotal,
              approximate: commentTotalApproximate,
              availableRelays: 1,
            }
          : undefined;
        applyCommentWindow(
          commentWindow,
          {
            posts: materializeNip29Forum(commentWindow.events, supportGroupId),
            reactions: [],
            profiles: [],
          },
          "replace",
        );
        if (resolvedCount !== undefined) {
          applyCommentCount(resolvedCount, generation);
        }
        loading = false;
        if (activePostId !== "") requestPostScroll(activePostId);

        const [[pluginCommunityResult, countResult], [hydrationResult]] =
          await Promise.all([backgroundMetadata, hydration]);
        if (sequence !== loadSequence || generation !== streamGeneration)
          return false;
        if (hydrationResult?.status === "fulfilled") {
          allReviews = mergeDiscussionPosts(
            allReviews,
            hydrationResult.value.posts,
            (post) => post.event.id,
            (left, right) => compareEvents(left.event, right.event),
          );
          reactions = mergeReactions(
            reactions,
            hydrationResult.value.reactions,
          );
          mergeProfiles(hydrationResult.value.profiles);
        }
        if (pluginCommunityResult.status === "fulfilled") {
          pluginRelease = pluginCommunityResult.value.release;
          pluginCommunityLoaded = true;
          pluginReactions = mergeReactions(
            pluginReactions,
            pluginCommunityResult.value.reactions,
          );
          mergeProfiles(pluginCommunityResult.value.profiles);
        }
        if (countResult.status === "fulfilled") {
          applyCommentCount(countResult.value, generation);
        }
        return true;
      }
      const [pluginCommunity, commentWindow] = await Promise.all([
        ensurePluginCommunity(summaryController?.signal),
        loadCommentWindow(
          targetIndex,
          "replace",
          currentRange,
          initialLoad && targetEventId === "",
          controller.signal,
        ),
      ]);
      const hydrated = await hydrateCommentWindow(
        commentWindow,
        controller.signal,
      );
      if (sequence !== loadSequence || generation !== streamGeneration)
        return false;
      pluginRelease = pluginCommunity.release;
      pluginCommunityLoaded = true;
      pluginReactions = mergeReactions(
        pluginReactions,
        pluginCommunity.reactions,
      );
      mergeProfiles(pluginCommunity.profiles);
      applyCommentWindow(commentWindow, hydrated, "replace", targetEventId);
      if (commentWindow.firstTimestamp === 0) {
        void resolveThreadStartTimestamp(
          commentWindow.total,
          commentWindow.lastTimestamp,
          generation,
        );
      }
      if (activePostId !== "") requestPostScroll(activePostId);
      return true;
    } catch (cause) {
      if (sequence !== loadSequence || isAbort(cause)) return false;
      error =
        cause instanceof Error
          ? cause.message
          : "The community relay is unavailable. Try again shortly.";
      return false;
    } finally {
      if (sequence === loadSequence) {
        loading = false;
        loadingJump = false;
      }
    }
  }

  async function loadAdjacent(
    direction: "prepend" | "append",
  ): Promise<boolean> {
    if (
      (direction === "prepend" && (loadingPrevious || !hasPrevious)) ||
      (direction === "append" && (loadingNext || !hasNext))
    ) {
      return false;
    }
    const generation = streamGeneration;
    const currentRange = {
      startIndex: pageStartIndex,
      endIndex: pageEndIndex,
      targetIndex: activeGlobalPostIndex,
    };
    if (direction === "prepend") {
      loadingPrevious = true;
      previousError = "";
    } else {
      loadingNext = true;
      nextError = "";
    }
    try {
      const window = await loadCommentWindow(
        activeGlobalPostIndex,
        direction,
        currentRange,
        false,
      );
      const hydrated = await hydrateCommentWindow(window);
      if (generation !== streamGeneration) return false;
      applyCommentWindow(window, hydrated, direction);
      return window.visibleIds.size > 0;
    } catch (cause) {
      if (generation !== streamGeneration) return false;
      const nextMessage =
        cause instanceof Error
          ? cause.message
          : "The community relay is unavailable. Try again shortly.";
      if (direction === "prepend") previousError = nextMessage;
      else nextError = nextMessage;
      return false;
    } finally {
      if (direction === "prepend") loadingPrevious = false;
      else loadingNext = false;
    }
  }

  async function refreshCurrentReactions(): Promise<void> {
    const forumTargets = [...visibleReviewIds];
    const allTargets = [
      ...forumTargets,
      ...(pluginRelease === undefined ? [] : [pluginRelease.id]),
    ];
    if (allTargets.length === 0) return;
    const events = (
      await queryAll({
        kinds: [NIP29_KINDS.reaction],
        "#e": allTargets,
        limit: Math.min(5_000, allTargets.length * 25),
      })
    ).events;
    const targetSet = new Set(allTargets);
    const nextForumReactions = materializeNip29Reactions(
      events,
      new Set(forumTargets),
    );
    reactions = mergeReactions(
      reactions.filter((reaction) => !targetSet.has(reaction.targetEventId)),
      nextForumReactions,
    );
    pluginReactions =
      pluginRelease === undefined
        ? pluginReactions
        : materializeNip29Reactions(events, new Set([pluginRelease.id])).filter(
            (reaction) => !["✅", "❌", "🚫"].includes(reaction.content),
          );
    const authors = [
      ...new Set(
        [...nextForumReactions, ...pluginReactions].map(
          (reaction) => reaction.event.pubkey,
        ),
      ),
    ].filter((author) => !profiles.has(author));
    if (authors.length > 0) {
      const profileEvents = (
        await queryAll({ kinds: [0], authors, limit: authors.length })
      ).events;
      mergeProfiles(parseProfiles(profileEvents));
    }
  }

  async function connect(): Promise<void> {
    error = "";
    message = "";
    try {
      const connectedSigner = new Nip07RegistrySigner();
      const pubkey = await connectedSigner.getPublicKey();
      const authenticated = await Promise.allSettled(
        relayUrls.map(async (url) =>
          authenticateRelay(relay(url), connectedSigner),
        ),
      );
      if (!authenticated.some((result) => result.status === "fulfilled")) {
        throw new Error("No NIP-29 relay accepted the NIP-42 login.");
      }
      signer = connectedSigner;
      signedInPubkey = pubkey;
      loadLocalPreferences();
      loadStoredLastReadCursor();
      void resolveStoredLastReadCursor();
      selectedPluginReaction = ownPluginReaction?.content ?? "";
      message = "Connected to the relay with your Nostr signer.";
    } catch (cause) {
      signer = undefined;
      signedInPubkey = "";
      loadLocalPreferences();
      loadStoredLastReadCursor();
      void resolveStoredLastReadCursor();
      error =
        cause instanceof Error
          ? cause.message
          : "Could not connect to the Nostr signer.";
    }
  }

  async function setIdentity(nextIdentity: RegistrySigner | undefined) {
    if (
      signer === nextIdentity &&
      (nextIdentity === undefined || signedInPubkey !== "")
    ) {
      return;
    }
    const revision = ++identityRevision;
    signer = nextIdentity;
    if (nextIdentity === undefined) {
      signedInPubkey = "";
      selectedPluginReaction = "";
      loadLocalPreferences();
      loadStoredLastReadCursor();
      void resolveStoredLastReadCursor();
      return;
    }
    try {
      const pubkey = await nextIdentity.getPublicKey();
      if (revision !== identityRevision || signer !== nextIdentity) return;
      signedInPubkey = pubkey;
      loadLocalPreferences();
      loadStoredLastReadCursor();
      void resolveStoredLastReadCursor();
      selectedPluginReaction = ownPluginReaction?.content ?? "";
    } catch {
      if (revision !== identityRevision || signer !== nextIdentity) return;
      signer = undefined;
      signedInPubkey = "";
      loadLocalPreferences();
    }
  }

  async function publish(event: NostrEvent): Promise<void> {
    const activeSigner = signer;
    if (activeSigner === undefined) {
      throw new Error("Connect a Nostr signer before publishing.");
    }
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        const client = relay(url);
        await authenticateRelay(client, activeSigner);
        return await client.publish(event);
      }),
    );
    if (!anyRelayPublished(results)) {
      throw new Error(relayPublishFailureMessage(results));
    }
  }

  async function ensureSigner(): Promise<RegistrySigner | undefined> {
    if (signer !== undefined) return signer;
    if (applicationAuthentication !== undefined) {
      let resumed = false;
      await applicationAuthentication.requestAuthentication(async () => {
        resumed = true;
        await setIdentity(applicationAuthentication.identity());
      });
      return resumed ? signer : undefined;
    }
    await connect();
    return signer;
  }

  async function submitPluginReaction(
    reaction = selectedPluginReaction,
  ): Promise<void> {
    const normalizedReaction = reaction.trim();
    selectedPluginReaction = normalizedReaction;
    const activeSigner = await ensureSigner();
    if (activeSigner === undefined) return;
    if (pluginRelease === undefined) {
      error = "This plugin does not have an approved NIP-29 release yet.";
      return;
    }
    if (!isValidNativeEmojiReaction(normalizedReaction)) {
      error = "Choose a reaction first.";
      return;
    }
    publishing = true;
    error = "";
    message = "";
    try {
      const event = await activeSigner.signEvent({
        kind: NIP29_KINDS.reaction,
        created_at: Math.floor(Date.now() / 1_000),
        content: normalizedReaction,
        tags: [
          ["e", pluginRelease.id],
          ["p", pluginRelease.pubkey],
          ["k", pluginRelease.kind.toString()],
        ],
      });
      await publish(event);
      message = "Plugin reaction published.";
      await refreshCurrentReactions();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Reaction failed.";
    } finally {
      publishing = false;
    }
  }

  async function submitComment(content = comment): Promise<boolean> {
    const submittedComment = content.trim();
    if (submittedComment === "") return false;
    commentError = "";
    const activeSigner = await ensureSigner();
    if (activeSigner === undefined) {
      comment = submittedComment;
      return false;
    }
    publishing = true;
    error = "";
    message = "";
    try {
      const template =
        replyingReview === undefined
          ? createNip29ForumThreadTemplate(
              supportGroupId,
              submittedComment,
              Math.floor(Date.now() / 1_000),
            )
          : createNip29ForumCommentTemplate(
              supportGroupId,
              reviews.find(
                (review) => review.event.id === replyingReview.rootEventId,
              )?.event ?? replyingReview.event,
              replyingReview.event,
              submittedComment,
              Math.floor(Date.now() / 1_000),
              relayUrls[0],
            );
      const event = await activeSigner.signEvent(template);
      await publish(event);
      comment = "";
      replyingTo = "";
      message = "Comment published.";
      await refresh(await globalIndexForEvent(event), event.id);
      return true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Comment failed.";
      commentError = error;
      comment = submittedComment;
      return false;
    } finally {
      publishing = false;
    }
  }

  async function submitReaction(
    review: ForumPost,
    content = "+",
  ): Promise<void> {
    const activeSigner = await ensureSigner();
    if (activeSigner === undefined) return;
    publishing = true;
    error = "";
    message = "";
    try {
      const event = await activeSigner.signEvent({
        kind: NIP29_KINDS.reaction,
        created_at: Math.floor(Date.now() / 1_000),
        content,
        tags: [
          ["e", review.event.id],
          ["p", review.event.pubkey],
          ["k", review.event.kind.toString()],
        ],
      });
      await publish(event);
      message = "Reaction published.";
      await refreshCurrentReactions();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Reaction failed.";
    } finally {
      publishing = false;
    }
  }

  function startReply(review: ForumPost): void {
    replyingTo = review.event.id;
  }

  function postNumber(eventId: string): number {
    const index = reviews.findIndex((review) => review.event.id === eventId);
    return index === -1 ? 0 : pageStartIndex + index + 1;
  }

  function shortKey(value: string): string {
    return value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-8)}`
      : value;
  }

  function handleCurrentPost(eventId: string, globalIndex: number): void {
    activePostId = eventId;
    recordLastRead(eventId, globalIndex);
    const post = allReviews.find((review) => review.event.id === eventId);
    if (post !== undefined) recordTopicRead(post);
  }

  async function loadSuggestedTopics(): Promise<void> {
    if (
      (suggestionsLoaded && suggestionsRootEventId === activeRootEventId) ||
      suggestionsLoading ||
      hasNext
    )
      return;
    suggestionsLoading = true;
    suggestionsController?.abort();
    const controller = new AbortController();
    suggestionsController = controller;
    const key = preferenceKey;
    try {
      const rootResult = await queryAll(
        {
          kinds: [NIP29_KINDS.forumThread],
          "#h": [supportGroupId],
          limit: 20,
        },
        controller.signal,
      );
      const roots = materializeNip29Forum(
        rootResult.events,
        supportGroupId,
      ).filter((post) => post.rootEventId !== activeRootEventId);
      const candidates = await Promise.all(
        roots.slice(-8).map(async (post): Promise<RegistrySuggestedTopic> => {
          const [latestResult, countResult] = await Promise.allSettled([
            queryAll(
              {
                kinds: [NIP29_KINDS.comment],
                "#h": [supportGroupId],
                "#E": [post.event.id],
                limit: 1,
              },
              controller.signal,
            ),
            countAll(
              {
                kinds: [NIP29_KINDS.comment],
                "#h": [supportGroupId],
                "#E": [post.event.id],
              },
              controller.signal,
            ),
          ]);
          const latestReply =
            latestResult.status === "fulfilled"
              ? latestResult.value.events.at(-1)
              : undefined;
          const preference = preferences.topics[post.event.id];
          const activityTimestamp = Math.max(
            post.event.created_at,
            latestReply?.created_at ?? 0,
          );
          const unread =
            preference?.forcedUnread === true ||
            (preference?.readCursor !== undefined &&
              activityTimestamp > preference.readCursor.createdAt);
          const title =
            post.event.tags.find((tag) => tag[0] === "title")?.[1]?.trim() ||
            post.content.trim().split(/\r?\n/u)[0]?.slice(0, 120) ||
            "Discussion";
          const count =
            countResult.status === "fulfilled" &&
            countResult.value.availableRelays > 0
              ? countResult.value
              : undefined;
          return {
            post,
            title,
            author: displayName(post.event.pubkey, profiles),
            activityTimestamp,
            ...(count === undefined ? {} : { replyCount: count.count }),
            ...(count === undefined
              ? {}
              : { replyCountApproximate: count.approximate }),
            unread,
            isNew:
              preference === undefined &&
              post.event.created_at >= preferences.forumFirstSeenAt,
          };
        }),
      );
      if (controller.signal.aborted || key !== preferenceKey) return;
      suggestedTopics = candidates
        .toSorted(
          (left, right) =>
            Number(right.unread) - Number(left.unread) ||
            Number(right.isNew) - Number(left.isNew) ||
            right.activityTimestamp - left.activityTimestamp ||
            left.post.event.id.localeCompare(right.post.event.id),
        )
        .slice(0, 5);
      suggestionsLoaded = true;
      suggestionsRootEventId = activeRootEventId;
    } catch (cause) {
      if (!isAbort(cause)) {
        suggestedTopics = [];
        suggestionsLoaded = true;
        suggestionsRootEventId = activeRootEventId;
      }
    } finally {
      if (suggestionsController === controller) {
        suggestionsController = undefined;
        suggestionsLoading = false;
      }
    }
  }

  async function navigateTimelineToIndex(
    index: number,
    _rememberOrigin = true,
    targetEventId = "",
  ): Promise<void> {
    if (
      commentTotal === 0 ||
      loadingJump ||
      !commentCountAvailable ||
      commentTotalApproximate
    )
      return;
    const targetIndex = Math.max(0, Math.min(index, commentTotal - 1));
    const localIndex = targetIndex - pageStartIndex;
    const localTarget = reviews[localIndex];
    if (
      localTarget !== undefined &&
      (targetEventId === "" || localTarget.event.id === targetEventId)
    ) {
      if (localTarget.event.id === activePostId) return;
      requestPostScroll(localTarget.event.id);
      return;
    }
    await refresh(targetIndex, targetEventId);
  }

  async function globalIndexForEvent(event: NostrEvent): Promise<number> {
    const baseFilter = {
      kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
      "#h": [supportGroupId],
    };
    const [before, through] = await Promise.all([
      countAll({ ...baseFilter, until: event.created_at - 1 }),
      countAll({ ...baseFilter, until: event.created_at }),
    ]);
    if (
      before.availableRelays === 0 ||
      through.availableRelays === 0 ||
      before.approximate ||
      through.approximate
    ) {
      throw new Error("The community relay is unavailable. Try again shortly.");
    }
    const bucketCount = through.count - before.count;
    if (bucketCount <= 0 || bucketCount > boundaryBucketLimit) {
      throw new DiscussionPaginationError(
        "The post position cannot be proven from the relay timestamp index.",
      );
    }
    const bucket = await queryAll({
      ...baseFilter,
      since: event.created_at,
      until: event.created_at,
      limit: bucketCount,
    });
    const events = bucket.events.toSorted(compareEvents);
    if (events.length !== bucketCount) {
      throw new DiscussionPaginationError(
        "The relay returned an incomplete same-second event bucket.",
      );
    }
    const bucketIndex = events.findIndex(
      (candidate) => candidate.id === event.id,
    );
    if (bucketIndex === -1) {
      throw new Error("The linked post is no longer available from the relay.");
    }
    return before.count + bucketIndex;
  }

  async function navigateToReview(review: ForumPost): Promise<void> {
    if (visibleReviewIds.has(review.event.id)) {
      requestPostScroll(review.event.id);
      return;
    }
    try {
      await navigateTimelineToIndex(
        await globalIndexForEvent(review.event),
        true,
        review.event.id,
      );
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Could not open the reply.";
    }
  }

  async function returnToTimelineOrigin(): Promise<void> {
    const cursor = lastReadCursor;
    if (cursor === undefined) return;
    try {
      const result = await queryAll({
        kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
        ids: [cursor.eventId],
        "#h": [supportGroupId],
        limit: 1,
      });
      const event = result.events.find(
        (candidate) =>
          candidate.id === cursor.eventId &&
          candidate.created_at === cursor.createdAt,
      );
      if (event === undefined) return;
      const index = await globalIndexForEvent(event);
      lastReadIndex = index;
      await navigateTimelineToIndex(index, false, event.id);
    } catch {
      lastReadIndex = undefined;
    }
  }

  async function initializeDiscussion(): Promise<void> {
    if (discussionInitialized) return;
    discussionInitialized = true;
    if (signer !== undefined && signedInPubkey === "") {
      try {
        signedInPubkey = await signer.getPublicKey();
      } catch {
        signer = undefined;
        signedInPubkey = "";
      }
    }
    loadLocalPreferences();
    loadStoredLastReadCursor();
    void resolveStoredLastReadCursor();
    const linkedEventId = window.location.hash.startsWith("#post-")
      ? window.location.hash.slice("#post-".length)
      : "";
    if (/^[0-9a-f]{64}$/u.test(linkedEventId)) {
      try {
        const result = await queryAll({
          kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
          ids: [linkedEventId],
          "#h": [supportGroupId],
          limit: 1,
        });
        const linkedEvent = result.events.find(
          (event) => event.id === linkedEventId,
        );
        if (linkedEvent !== undefined) {
          await refresh(await globalIndexForEvent(linkedEvent), linkedEvent.id);
          return;
        }
      } catch (cause) {
        error =
          cause instanceof Error
            ? cause.message
            : "Could not open the linked post.";
      }
    }
    await refresh(0);
  }

  async function initializeSummary(): Promise<void> {
    if (summaryController !== undefined) return;
    summaryController = new AbortController();
    summaryLoading = true;
    if (signer !== undefined && signedInPubkey === "") {
      try {
        signedInPubkey = await signer.getPublicKey();
      } catch {
        signedInPubkey = "";
      }
    }
    loadLocalPreferences();
    try {
      await Promise.allSettled([
        ensurePluginCommunity(summaryController.signal),
        ensureCommentCount(summaryController.signal),
      ]);
    } finally {
      summaryLoading = false;
    }
  }

  function initialize(): void {
    void initializeSummary();
    void initializeDiscussion();
  }

  function dispose(): void {
    jumpController?.abort();
    summaryController?.abort();
    suggestionsController?.abort();
    dataSource.close();
  }

  function cancelReply(): void {
    replyingTo = "";
  }

  function dismissError(): void {
    error = "";
    commentError = "";
  }

  return {
    get name() {
      return name;
    },
    get allReviews() {
      return allReviews;
    },
    get reviews() {
      return reviews;
    },
    get reactions() {
      return reactions;
    },
    get profiles() {
      return profiles;
    },
    get signedInPubkey() {
      return signedInPubkey;
    },
    get selectedPluginReaction() {
      return selectedPluginReaction;
    },
    set selectedPluginReaction(value: string) {
      selectedPluginReaction = value;
    },
    get comment() {
      return comment;
    },
    set comment(value: string) {
      comment = value;
    },
    get commentError() {
      return commentError;
    },
    get activePostId() {
      return activePostId;
    },
    get timelineReturnIndex() {
      return lastReadIndex;
    },
    get lastReadIndex() {
      return lastReadIndex;
    },
    get commentTotal() {
      return commentTotal;
    },
    get commentTotalApproximate() {
      return commentTotalApproximate;
    },
    get commentCountAvailable() {
      return commentCountAvailable;
    },
    get pageStartIndex() {
      return pageStartIndex;
    },
    get pageEndIndex() {
      return pageEndIndex;
    },
    get threadFirstTimestamp() {
      return threadFirstTimestamp;
    },
    get threadLastTimestamp() {
      return threadLastTimestamp;
    },
    get loading() {
      return loading;
    },
    get summaryLoading() {
      return summaryLoading;
    },
    get loadingPrevious() {
      return loadingPrevious;
    },
    get loadingNext() {
      return loadingNext;
    },
    get loadingJump() {
      return loadingJump;
    },
    get previousError() {
      return previousError;
    },
    get nextError() {
      return nextError;
    },
    get publishing() {
      return publishing;
    },
    get message() {
      return message;
    },
    get error() {
      return error;
    },
    get scrollTargetPostId() {
      return scrollTargetPostId;
    },
    get scrollRevision() {
      return scrollRevision;
    },
    get relayUrls() {
      return relayUrls;
    },
    get pluginRelease() {
      return pluginRelease;
    },
    setReleaseEventId,
    get currentPluginReactions() {
      return currentPluginReactions;
    },
    get pluginReactionSummary() {
      return pluginReactionSummary;
    },
    get ownPluginReaction() {
      return ownPluginReaction;
    },
    get replyingReview() {
      return replyingReview;
    },
    get activeGlobalPostIndex() {
      return activeGlobalPostIndex;
    },
    get activePostTimestamp() {
      return activePostTimestamp;
    },
    get activeRootEventId() {
      return activeRootEventId;
    },
    get followed() {
      return preferences.followed;
    },
    get bookmarked() {
      return preferences.bookmarked;
    },
    get forcedUnread() {
      return activeTopicPreference?.forcedUnread === true;
    },
    get unreadPostCount() {
      return unreadPostCount;
    },
    get composerHeight() {
      return preferences.composerHeight ?? 320;
    },
    get composerDraftKey() {
      return preferenceKey;
    },
    get suggestedTopics() {
      return suggestedTopics;
    },
    get suggestionsLoading() {
      return suggestionsLoading;
    },
    get hasPrevious() {
      return hasPrevious;
    },
    get hasNext() {
      return hasNext;
    },
    get displayedPostStart() {
      return displayedPostStart;
    },
    get displayedPostEnd() {
      return displayedPostEnd;
    },
    get participantCount() {
      return participantCount;
    },
    get commentPageSize() {
      return commentPageSize;
    },
    initialize,
    initializeSummary,
    initializeDiscussion,
    dispose,
    cancelReply,
    dismissError,
    toggleFollow,
    toggleBookmark,
    markUnread,
    setComposerHeight,
    loadSuggestedTopics,
    connect,
    setIdentity,
    submitPluginReaction,
    submitComment,
    submitReaction,
    startReply,
    postNumber,
    shortKey,
    handleCurrentPost,
    refresh,
    loadAdjacent,
    navigateToReview,
    navigateTimelineToIndex,
    returnToTimelineOrigin,
  };
}

export type RegistryCommunityController = ReturnType<
  typeof createRegistryCommunityController
>;
