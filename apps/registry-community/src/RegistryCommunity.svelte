<svelte:options customElement={{ shadow: "open" }} />

<script lang="ts">
  import { onMount } from "svelte";
  import {
    finalizeEvent,
    generateSecretKey,
    getPublicKey,
  } from "nostr-tools/pure";

  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Card from "@lapismd/design-core/shadcn/card";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import {
    authenticateRegistryRelay,
    Nip07RegistrySigner,
    type RegistrySigner,
  } from "@lapismd/registry-auth";
  import { WebSocketRegistryRelay } from "@lapismd/registry-nostr";
  import {
    NIP29_KINDS,
    createNip29ForumCommentTemplate,
    createNip29ForumThreadTemplate,
    LAPIS_GROUPS,
    lapisGroupId,
    lapisPluginSupportGroupId,
    type NostrEvent,
  } from "@lapismd/registry-protocol";

  import {
    anyRelayPublished,
    displayName,
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
  import DiscussionPostStream from "./DiscussionPostStream.svelte";
  import DiscussionTimeline from "./DiscussionTimeline.svelte";
  import {
    DiscussionPaginationError,
    adjacentDiscussionWindow,
    centeredDiscussionWindow,
    initialDiscussionWindow,
    mergeDiscussionPosts,
    sliceBoundaryWindow,
    type DiscussionLoadDirection,
    type DiscussionWindowRange,
  } from "./discussion-stream.js";

  let {
    plugin = "",
    name = "Plugin",
    version = "",
    publisher = "",
    relays = "[]",
  }: {
    plugin?: string;
    name?: string;
    version?: string;
    publisher?: string;
    relays?: string;
  } = $props();

  let allReviews = $state<ForumPost[]>([]);
  let reactions = $state<ForumReaction[]>([]);
  let pluginRelease = $state<NostrEvent | undefined>();
  let pluginReactions = $state<ForumReaction[]>([]);
  let profiles = $state<ReadonlyMap<string, CommunityProfile>>(new Map());
  let signer = $state<RegistrySigner | undefined>();
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
  let composerElement: HTMLDivElement | undefined;
  let scrollTargetPostId = $state("");
  let scrollRevision = $state(0);
  let loadSequence = 0;
  let streamGeneration = 0;
  let jumpController: AbortController | undefined;

  const clients = new Map<string, WebSocketRegistryRelay>();
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

  function relay(url: string): WebSocketRegistryRelay {
    const current = clients.get(url);
    if (current !== undefined) return current;
    const created = new WebSocketRegistryRelay(url, {
      authenticationRelayUrl: url,
    });
    clients.set(url, created);
    return created;
  }

  async function queryAll(
    filter: Parameters<WebSocketRegistryRelay["query"]>[0],
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
    filter: Parameters<WebSocketRegistryRelay["count"]>[0],
    signal?: AbortSignal,
  ): Promise<{ count: number; availableRelays: number }> {
    signal?.throwIfAborted();
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        const client = relay(url);
        await authenticateRegistryRelay(client, signer ?? readSigner, signal);
        return await client.count(filter, signal);
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

  async function submitPluginReaction(): Promise<void> {
    const activeSigner = await ensureSigner();
    if (activeSigner === undefined) return;
    if (pluginRelease === undefined) {
      error = "This plugin does not have an approved NIP-29 release yet.";
      return;
    }
    if (!["👍", "❤️", "🎉", "👀", "⭐"].includes(selectedPluginReaction)) {
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
        content: selectedPluginReaction,
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

  async function submitComment(): Promise<void> {
    const activeSigner = await ensureSigner();
    if (activeSigner === undefined) return;
    publishing = true;
    error = "";
    message = "";
    try {
      const template =
        replyingReview === undefined
          ? createNip29ForumThreadTemplate(
              supportGroupId,
              comment,
              Math.floor(Date.now() / 1_000),
            )
          : createNip29ForumCommentTemplate(
              supportGroupId,
              reviews.find(
                (review) => review.event.id === replyingReview.rootEventId,
              )?.event ?? replyingReview.event,
              replyingReview.event,
              comment,
              Math.floor(Date.now() / 1_000),
              relayUrls[0],
            );
      const event = await activeSigner.signEvent(template);
      await publish(event);
      comment = "";
      replyingTo = "";
      message = "Comment published.";
      await refresh(await globalIndexForEvent(event), event.id);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Comment failed.";
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

  onMount(() => {
    void initializeDiscussion();
    return () => {
      jumpController?.abort();
      for (const client of clients.values()) client.close();
      clients.clear();
    };
  });
</script>

<section
  class="community"
  aria-labelledby="community-title"
  data-design-core="0.1.0"
  data-comment-total={commentTotal}
  data-loaded-comments={reviews.length}
  data-page-start={pageStartIndex}
  data-page-end={pageEndIndex}
>
  <Card.Root class="community-card">
    <Card.Header class="community-header">
      <div>
        <Card.Title id="community-title">{name} community discussion</Card.Title
        >
        <Card.Description>
          NIP-29 forum posts, replies, and reactions read directly from the
          relay.
        </Card.Description>
      </div>
      <Badge
        variant={loading || loadingJump
          ? "secondary"
          : error
            ? "destructive"
            : "outline"}
      >
        {loading || loadingJump
          ? "Syncing"
          : error
            ? "Relay issue"
            : `${relayUrls.length} relay${relayUrls.length === 1 ? "" : "s"}`}
      </Badge>
    </Card.Header>

    <Card.Content class="community-content">
      <div class="topic-summary" aria-live="polite">
        <div><strong>{commentTotal}</strong><span>posts</span></div>
        <div>
          <strong>{reactions.length}</strong><span>page reactions</span>
        </div>
        <div>
          <strong>{participantCount}</strong><span>page participants</span>
        </div>
        <div>
          <strong>{currentPluginReactions.length}</strong>
          <span>plugin reactions</span>
        </div>
      </div>

      <div class="rating-control">
        <div>
          <span class="field-label" id="rating-label">React to this plugin</span
          >
          <p>
            {#if pluginReactionSummary.length === 0}
              Be the first to react to the latest release.
            {:else}
              {pluginReactionSummary
                .map((group) => `${group.symbol} ${group.count}`)
                .join(" · ")}
            {/if}
          </p>
        </div>
        <ToggleGroup.Root
          type="single"
          variant="outline"
          bind:value={selectedPluginReaction}
          aria-labelledby="rating-label"
          disabled={publishing}
        >
          {#each ["👍", "❤️", "🎉", "👀", "⭐"] as reaction}
            <ToggleGroup.Item value={reaction} aria-label={`React ${reaction}`}>
              <span aria-hidden="true">{reaction}</span>
            </ToggleGroup.Item>
          {/each}
        </ToggleGroup.Root>
        <div class="actions">
          <Button
            size="sm"
            disabled={publishing ||
              selectedPluginReaction === "" ||
              pluginRelease === undefined}
            onclick={submitPluginReaction}
          >
            {ownPluginReaction ? "Update reaction" : "Publish reaction"}
          </Button>
        </div>
      </div>

      {#if error}
        <p class="notice error" role="alert">{error}</p>
      {:else if message}
        <p class="notice" role="status">{message}</p>
      {/if}

      <div
        class="discussion"
        aria-busy={loading || loadingJump || loadingPrevious || loadingNext}
      >
        <div class="topic-column">
          <div class="comments-heading">
            <div>
              <h3>Discussion</h3>
              <p>
                {#if commentTotal === 0}
                  Follow the conversation in posting order.
                {:else}
                  Loaded posts {displayedPostStart}–{displayedPostEnd} of {commentTotal}.
                  Scroll for adjacent posts or use the timeline to jump.
                {/if}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading || loadingJump}
              onclick={() => refresh(activeGlobalPostIndex)}
            >
              Refresh
            </Button>
          </div>

          <div class="comment-form" bind:this={composerElement}>
            <div class="composer-heading">
              <div>
                <span class="field-label">
                  {replyingReview === undefined
                    ? "Add to the discussion"
                    : "Reply to a post"}
                </span>
                {#if replyingReview}
                  <p>
                    Replying to {displayName(
                      replyingReview.event.pubkey,
                      profiles,
                    )} · post #{postNumber(replyingReview.event.id)}
                  </p>
                {:else}
                  <p>Post a top-level comment about {name}.</p>
                {/if}
              </div>
              {#if replyingReview}
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => (replyingTo = "")}>Cancel</Button
                >
              {/if}
            </div>
            <Textarea
              id="registry-comment"
              bind:value={comment}
              maxlength={10000}
              rows={5}
              placeholder={`Share your experience with ${name}`}
              disabled={publishing}
            />
            <div class="form-footer">
              <span>
                {signedInPubkey === ""
                  ? "A NIP-07 signer is required to publish."
                  : shortKey(signedInPubkey)}
              </span>
              <div class="actions">
                {#if signedInPubkey === ""}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={publishing}
                    onclick={connect}>Connect Nostr</Button
                  >
                {/if}
                <Button
                  size="sm"
                  disabled={publishing || comment.trim() === ""}
                  onclick={submitComment}
                  >{replyingReview
                    ? "Publish reply"
                    : "Publish comment"}</Button
                >
              </div>
            </div>
          </div>

          {#if loading}
            <p class="empty">Reading signed events from the relay…</p>
          {:else if reviews.length === 0}
            <p class="empty">No comments yet. Start the conversation.</p>
          {:else}
            <DiscussionPostStream
              posts={reviews}
              contextPosts={allReviews}
              {reactions}
              {profiles}
              startIndex={pageStartIndex}
              total={commentTotal}
              {activePostId}
              targetPostId={scrollTargetPostId}
              {scrollRevision}
              {publishing}
              {hasPrevious}
              {hasNext}
              {loadingPrevious}
              {loadingNext}
              {previousError}
              {nextError}
              onCurrentPost={handleCurrentPost}
              onPrepend={() => loadAdjacent("prepend")}
              onAppend={() => loadAdjacent("append")}
              onNavigate={navigateToReview}
              onReply={startReply}
              onReact={submitReaction}
            />
          {/if}
        </div>

        {#if commentTotal > 1 && threadFirstTimestamp > 0 && threadLastTimestamp > 0}
          <DiscussionTimeline
            total={commentTotal}
            currentIndex={activeGlobalPostIndex}
            currentTimestamp={activePostTimestamp}
            firstTimestamp={threadFirstTimestamp}
            lastTimestamp={threadLastTimestamp}
            returnIndex={timelineReturnIndex}
            disabled={loadingJump}
            pageSize={commentPageSize}
            onJump={navigateTimelineToIndex}
            onReturn={returnToTimelineOrigin}
          />
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
</section>

<style>
  :host {
    --spacing: 0.25rem;
    --radius: 0.625rem;
    --text-sm: 0.875rem;
    --text-sm--line-height: 1.25rem;
    --font-weight-medium: 500;
    --background: oklch(0.17 0.015 278);
    --foreground: oklch(0.94 0.012 278);
    --card: oklch(0.205 0.018 278);
    --card-foreground: var(--foreground);
    --primary: oklch(0.61 0.2 278);
    --primary-foreground: oklch(0.98 0.01 278);
    --secondary: oklch(0.27 0.028 278);
    --secondary-foreground: oklch(0.92 0.018 278);
    --muted: oklch(0.25 0.022 278);
    --muted-foreground: oklch(0.72 0.025 278);
    --border: oklch(0.36 0.03 278);
    --input: var(--border);
    --ring: oklch(0.68 0.16 278);
    --destructive: oklch(0.65 0.22 27);
    --destructive-foreground: white;
    color-scheme: dark;
    display: block;
    color: var(--foreground);
    font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  :global(.community-header),
  .comments-heading,
  .composer-heading,
  .form-footer,
  .actions {
    display: flex;
    align-items: center;
  }

  :global(.community-header),
  .comments-heading,
  .composer-heading,
  .form-footer {
    justify-content: space-between;
    gap: 1rem;
  }

  :global(.community-card) {
    overflow: visible;
  }

  :global(.community-content) {
    display: grid;
    gap: 1.4rem;
  }

  .topic-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-block: 1px solid var(--border);
  }

  .topic-summary > div {
    display: grid;
    gap: 0.15rem;
    padding: 1rem;
    text-align: center;
  }

  .topic-summary > div + div {
    border-left: 1px solid var(--border);
  }

  .topic-summary strong {
    font-size: 1.25rem;
  }

  .topic-summary > div > span,
  .rating-control p,
  .comments-heading p,
  .composer-heading p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  .rating-control {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) auto auto;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: color-mix(in oklch, var(--card) 92%, var(--secondary));
  }

  .field-label,
  h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 650;
  }

  .actions {
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .notice,
  .empty {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.9rem;
  }

  .notice {
    border-left: 3px solid var(--primary);
    padding: 0.6rem 0.8rem;
    background: var(--secondary);
  }

  .notice.error {
    border-color: var(--destructive);
  }

  .discussion {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 9rem;
    gap: clamp(1.5rem, 4vw, 3.5rem);
  }

  .topic-column {
    min-width: 0;
  }

  .comment-form {
    display: grid;
    gap: 0.75rem;
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: color-mix(in oklch, var(--card) 88%, var(--secondary));
    scroll-margin-top: 6rem;
  }

  .form-footer {
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  @media (max-width: 62rem) {
    .discussion {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 44rem) {
    :global(.community-header),
    .comments-heading,
    .composer-heading,
    .form-footer {
      align-items: flex-start;
      flex-direction: column;
    }

    .topic-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .topic-summary > div:nth-child(3) {
      border-left: 0;
      border-top: 1px solid var(--border);
    }

    .topic-summary > div:nth-child(4) {
      border-top: 1px solid var(--border);
    }

    .rating-control {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
