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
  latestReactionByAuthor,
  materializeNip29Forum,
  materializeNip29Reactions,
  parseProfiles,
  parseRelayUrls,
  reactionGroups,
  seekTimestampForCount,
  timelineTimestamp,
  type CommunityProfile,
  type ForumPost,
  type ForumReaction,
} from "./model.js";
import {
  DiscussionPaginationError,
  adjacentDiscussionWindow,
  centeredDiscussionWindow,
  initialDiscussionWindow,
  mergeDiscussionPosts,
  sliceBoundaryWindow,
  type DiscussionLoadDirection,
  type DiscussionWindowRange,
} from "../discussion-post-stream/discussion-stream.js";

export interface RegistryCommunityProps {
  plugin?: string;
  name?: string;
  version?: string;
  publisher?: string;
  relays?: string;
}

export interface RegistryCommunityControllerOptions
  extends RegistryCommunityProps {
  dataSource?: RegistryCommunityDataSource;
  identity?: RegistrySigner;
}

export function createRegistryCommunityController(
  options: RegistryCommunityControllerOptions,
) {
  const plugin = options.plugin ?? "";
  const name = options.name ?? "Plugin";
  const publisher = options.publisher ?? "";
  const relays = options.relays ?? "[]";

  let allReviews = $state<ForumPost[]>([]);
  let reactions = $state<ForumReaction[]>([]);
  let pluginRelease = $state<NostrEvent | undefined>();
  let pluginReactions = $state<ForumReaction[]>([]);
  let profiles = $state<ReadonlyMap<string, CommunityProfile>>(new Map());
  let signer = $state<RegistrySigner | undefined>(options.identity);
  let signedInPubkey = $state("");
  let selectedPluginReaction = $state("");
  let comment = $state("");
  let replyingTo = $state("");
  let activePostId = $state("");
  let timelineReturnIndex = $state<number | undefined>();
  let commentTotal = $state(0);
  let pageStartIndex = $state(0);
  let pageEndIndex = $state(0);
  let visibleReviewIds = $state<ReadonlySet<string>>(new Set());
  let threadFirstTimestamp = $state(0);
  let threadLastTimestamp = $state(0);
  let loading = $state(true);
  let loadingPrevious = $state(false);
  let loadingNext = $state(false);
  let loadingJump = $state(false);
  let previousError = $state("");
  let nextError = $state("");
  let publishing = $state(false);
  let message = $state("");
  let error = $state("");
  let commentError = $state("");
  let composerElement: HTMLDivElement | undefined;
  let scrollTargetPostId = $state("");
  let scrollRevision = $state(0);
  let loadSequence = 0;
  let streamGeneration = 0;
  let jumpController: AbortController | undefined;

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

  const relayUrls = $derived(parseRelayUrls(relays));
  const supportGroupId = $derived(
    plugin === "" ? "" : lapisPluginSupportGroupId(plugin),
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
  const hasPrevious = $derived(pageStartIndex > 0);
  const hasNext = $derived(pageEndIndex < commentTotal);
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

  async function queryAll(
    filter: Parameters<CommunityRelay["query"]>[0],
    signal?: AbortSignal,
  ): Promise<{ events: NostrEvent[]; availableRelays: number }> {
    signal?.throwIfAborted();
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        const client = relay(url);
        await authenticateRegistryRelay(client, signer ?? readSigner, signal);
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
    return {
      events: [...events.values()],
      availableRelays: successful.length,
    };
  }

  async function countAll(
    filter: Parameters<CommunityRelay["query"]>[0],
    signal?: AbortSignal,
  ): Promise<{ count: number; availableRelays: number }> {
    signal?.throwIfAborted();
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        const client = relay(url);
        await authenticateRegistryRelay(client, signer ?? readSigner, signal);
        if (client.count !== undefined) {
          return await client.count(filter, signal);
        }
        const countFilter = { ...filter };
        delete countFilter.limit;
        return (await client.query(countFilter, signal)).length;
      }),
    );
    signal?.throwIfAborted();
    const counts = results
      .filter(
        (result): result is PromiseFulfilledResult<number> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
    return {
      count: counts.length === 0 ? 0 : Math.max(...counts),
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
  }

  interface HydratedCommentWindow {
    posts: ForumPost[];
    reactions: ForumReaction[];
    profiles: CommunityProfile[];
  }

  async function loadCommentWindow(
    targetIndex: number,
    direction: DiscussionLoadDirection,
    currentRange: DiscussionWindowRange,
    signal?: AbortSignal,
  ): Promise<LoadedCommentWindow> {
    const baseFilter = {
      kinds: [NIP29_KINDS.forumThread, NIP29_KINDS.comment],
      "#h": [supportGroupId],
    };
    const [countResult, latestResult] = await Promise.all([
      countAll(baseFilter, signal),
      queryAll({ ...baseFilter, limit: 1 }, signal),
    ]);
    if (countResult.availableRelays === 0) {
      throw new Error("The community relay must support NIP-45 event counts.");
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

    const page =
      direction === "replace"
        ? pageEndIndex === 0 && targetIndex <= 0
          ? initialDiscussionWindow(countResult.count, commentPageSize)
          : centeredDiscussionWindow(
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
    const countCache = new Map<number, number>([
      [latestEvent.created_at, countResult.count],
    ]);
    const boundary = await seekTimestampForCount(
      page.endIndex,
      latestEvent.created_at,
      countResult.count,
      async (until) => {
        const cached = countCache.get(until);
        if (cached !== undefined) return cached;
        const result = await countAll({ ...baseFilter, until }, signal);
        if (result.availableRelays === 0) {
          throw new Error(
            "The community relay stopped responding to NIP-45 counts.",
          );
        }
        countCache.set(until, result.count);
        return result.count;
      },
    );
    const countBeforeBoundary =
      boundary.timestamp <= 0
        ? { count: 0, availableRelays: countResult.availableRelays }
        : await countAll(
            { ...baseFilter, until: boundary.timestamp - 1 },
            signal,
          );
    const expectedBoundaryCount = boundary.count - countBeforeBoundary.count;
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
        ? { events: [], availableRelays: boundaryResult.availableRelays }
        : await queryAll(
            {
              ...baseFilter,
              until: boundary.timestamp - 1,
              limit: olderNeeded,
            },
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
    let firstTimestamp =
      page.startIndex === 0
        ? (pageEvents[0]?.created_at ?? threadFirstTimestamp)
        : threadFirstTimestamp;
    if (firstTimestamp === 0) {
      const firstBoundary = await seekTimestampForCount(
        1,
        latestEvent.created_at,
        countResult.count,
        async (until) => {
          const cached = countCache.get(until);
          if (cached !== undefined) return cached;
          const result = await countAll({ ...baseFilter, until }, signal);
          if (result.availableRelays === 0) {
            throw new Error(
              "The community relay stopped responding to NIP-45 counts.",
            );
          }
          countCache.set(until, result.count);
          return result.count;
        },
      );
      firstTimestamp = firstBoundary.timestamp;
    }

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

  async function loadPluginCommunity(signal?: AbortSignal): Promise<{
    release: NostrEvent | undefined;
    reactions: ForumReaction[];
    profiles: CommunityProfile[];
  }> {
    const releaseResult = await queryAll(
      {
        kinds: [NIP29_KINDS.streamMessage],
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
    if (direction === "replace") {
      pageStartIndex = window.startIndex;
      pageEndIndex = window.endIndex;
    } else if (direction === "prepend") {
      pageStartIndex = window.startIndex;
    } else {
      pageEndIndex = window.endIndex;
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
      const [pluginCommunity, commentWindow] = await Promise.all([
        loadPluginCommunity(controller.signal),
        loadCommentWindow(
          targetIndex,
          "replace",
          currentRange,
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
      pluginReactions = mergeReactions(
        pluginReactions,
        pluginCommunity.reactions,
      );
      mergeProfiles(pluginCommunity.profiles);
      applyCommentWindow(commentWindow, hydrated, "replace", targetEventId);
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
          authenticateRegistryRelay(relay(url), connectedSigner),
        ),
      );
      if (!authenticated.some((result) => result.status === "fulfilled")) {
        throw new Error("No NIP-29 relay accepted the NIP-42 login.");
      }
      signer = connectedSigner;
      signedInPubkey = pubkey;
      selectedPluginReaction = ownPluginReaction?.content ?? "";
      message = "Connected to the relay with your Nostr signer.";
    } catch (cause) {
      signer = undefined;
      signedInPubkey = "";
      error =
        cause instanceof Error
          ? cause.message
          : "Could not connect to the Nostr signer.";
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
        await authenticateRegistryRelay(client, activeSigner);
        return await client.publish(event);
      }),
    );
    if (!anyRelayPublished(results)) {
      throw new Error("No community relay accepted the signed event.");
    }
  }

  async function ensureSigner(): Promise<RegistrySigner | undefined> {
    if (signer === undefined) await connect();
    return signer;
  }

  async function submitPluginReaction(
    reaction = selectedPluginReaction,
  ): Promise<void> {
    selectedPluginReaction = reaction;
    const activeSigner = await ensureSigner();
    if (activeSigner === undefined) return;
    if (pluginRelease === undefined) {
      error = "This plugin does not have an approved NIP-29 release yet.";
      return;
    }
    if (!["👍", "❤️", "🎉", "👀", "⭐"].includes(reaction)) {
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
        content: reaction,
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
      commentError = error || "Could not connect to the Nostr signer.";
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
    requestAnimationFrame(() =>
      composerElement?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
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

  function handleCurrentPost(eventId: string): void {
    activePostId = eventId;
  }

  async function navigateTimelineToIndex(
    index: number,
    rememberOrigin = true,
    targetEventId = "",
  ): Promise<void> {
    if (commentTotal === 0 || loadingJump) return;
    const targetIndex = Math.max(0, Math.min(index, commentTotal - 1));
    const localIndex = targetIndex - pageStartIndex;
    const localTarget = reviews[localIndex];
    if (
      localTarget !== undefined &&
      (targetEventId === "" || localTarget.event.id === targetEventId)
    ) {
      if (localTarget.event.id === activePostId) return;
      if (rememberOrigin && timelineReturnIndex === undefined) {
        timelineReturnIndex = activeGlobalPostIndex;
      }
      requestPostScroll(localTarget.event.id);
      return;
    }
    if (rememberOrigin && timelineReturnIndex === undefined) {
      timelineReturnIndex = activeGlobalPostIndex;
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
    if (before.availableRelays === 0 || through.availableRelays === 0) {
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
    const target = timelineReturnIndex;
    timelineReturnIndex = undefined;
    if (target !== undefined) await navigateTimelineToIndex(target, false);
  }

  async function initializeDiscussion(): Promise<void> {
    if (signer !== undefined && signedInPubkey === "") {
      signedInPubkey = await signer.getPublicKey();
    }
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

  function initialize(): void {
    void initializeDiscussion();
  }

  function dispose(): void {
    jumpController?.abort();
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
      return timelineReturnIndex;
    },
    get commentTotal() {
      return commentTotal;
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
    get composerElement() {
      return composerElement;
    },
    set composerElement(value: HTMLDivElement | undefined) {
      composerElement = value;
    },
    initialize,
    dispose,
    cancelReply,
    dismissError,
    connect,
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
