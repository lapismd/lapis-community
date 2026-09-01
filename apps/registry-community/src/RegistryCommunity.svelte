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
    BUZZ_REGISTRY_KINDS,
    createBuzzForumReplyTemplate,
    createBuzzForumRootTemplate,
    LAPIS_BUZZ_GROUP_PATHS,
    lapisBuzzGroupId,
    lapisPluginSupportGroupId,
    type NostrEvent,
  } from "@lapismd/registry-protocol";

  import {
    anyRelayPublished,
    avatarHue,
    commentPageWindow,
    displayName,
    initials,
    latestReactionByAuthor,
    materializeBuzzForum,
    materializeBuzzReactions,
    parseProfiles,
    parseRelayUrls,
    reactionGroups,
    seekTimestampForCount,
    timelineIndexFromPosition,
    timelinePosition,
    timelineTimestamp,
    type CommunityProfile,
    type ForumPost,
    type ForumReaction,
  } from "./model.js";

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
  let timelinePreviewIndex = $state<number | undefined>();
  let timelineReturnIndex = $state<number | undefined>();
  let timelineDragging = $state(false);
  let commentTotal = $state(0);
  let pageStartIndex = $state(0);
  let pageEndIndex = $state(0);
  let visibleReviewIds = $state<ReadonlySet<string>>(new Set());
  let threadFirstTimestamp = $state(0);
  let threadLastTimestamp = $state(0);
  let loading = $state(true);
  let publishing = $state(false);
  let message = $state("");
  let error = $state("");
  let composerElement: HTMLDivElement | undefined;
  let timelineElement = $state<HTMLDivElement | undefined>();
  let timelineHandleElement = $state<HTMLDivElement | undefined>();
  let timelinePointerId: number | undefined;
  let timelineDragOffset = 0;
  let loadSequence = 0;
  let observer: IntersectionObserver | undefined;

  const clients = new Map<string, WebSocketRegistryRelay>();
  const readSecretKey = generateSecretKey();
  const readPubkey = getPublicKey(readSecretKey);
  const readSigner: RegistrySigner = {
    getPublicKey: async () => readPubkey,
    signEvent: async (template) => finalizeEvent(template, readSecretKey),
  };
  const postElements = new Map<string, HTMLElement>();
  const commentPageSize = 20;
  const commentQueryLimit = 100;
  const parentContextLimit = 80;
  const parentContextDepth = 12;

  const relayUrls = $derived(parseRelayUrls(relays));
  const supportGroupId = $derived(
    plugin === "" ? "" : lapisPluginSupportGroupId(plugin),
  );
  const releaseGroupId = lapisBuzzGroupId(
    LAPIS_BUZZ_GROUP_PATHS.pluginReleases,
  );
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
  const timelineDisplayIndex = $derived(
    timelinePreviewIndex ?? activeGlobalPostIndex,
  );
  const timelineDisplayTimestamp = $derived.by(() => {
    const localIndex = timelineDisplayIndex - pageStartIndex;
    return (
      reviews[localIndex]?.event.created_at ??
      timelineTimestamp(
        timelineDisplayIndex,
        commentTotal,
        threadFirstTimestamp,
        threadLastTimestamp,
      )
    );
  });
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
  ): Promise<{ events: NostrEvent[]; availableRelays: number }> {
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        const client = relay(url);
        await authenticateRegistryRelay(client, signer ?? readSigner);
        return await client.query(filter);
      }),
    );
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
  ): Promise<{ count: number; availableRelays: number }> {
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        const client = relay(url);
        await authenticateRegistryRelay(client, signer ?? readSigner);
        return await client.count(filter);
      }),
    );
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
      const result = await queryAll({
        kinds: [BUZZ_REGISTRY_KINDS.forumRoot, BUZZ_REGISTRY_KINDS.forumReply],
        ids: frontier.slice(0, remaining),
        "#h": [supportGroupId],
        limit: Math.min(frontier.length, remaining),
      });
      const added = result.events.filter((event) => !context.has(event.id));
      for (const event of added) context.set(event.id, event);
      frontier = parentIds(added).filter((id) => !context.has(id));
    }
    return [...context.values()];
  }

  async function loadCommentPage(targetIndex: number): Promise<{
    events: NostrEvent[];
    visibleIds: ReadonlySet<string>;
    total: number;
    startIndex: number;
    endIndex: number;
    targetIndex: number;
    firstTimestamp: number;
    lastTimestamp: number;
    availableRelays: number;
  }> {
    const baseFilter = {
      kinds: [BUZZ_REGISTRY_KINDS.forumRoot, BUZZ_REGISTRY_KINDS.forumReply],
      "#h": [supportGroupId],
    };
    const [countResult, latestResult] = await Promise.all([
      countAll(baseFilter),
      queryAll({ ...baseFilter, limit: 1 }),
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

    const page = commentPageWindow(
      countResult.count,
      targetIndex,
      commentPageSize,
    );
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
        const result = await countAll({ ...baseFilter, until });
        if (result.availableRelays === 0) {
          throw new Error(
            "The community relay stopped responding to NIP-45 counts.",
          );
        }
        countCache.set(until, result.count);
        return result.count;
      },
    );
    const commentResult = await queryAll({
      ...baseFilter,
      until: boundary.timestamp,
      limit: commentQueryLimit,
    });
    if (commentResult.availableRelays === 0) {
      throw new Error("The community relay is unavailable. Try again shortly.");
    }
    const candidates = commentResult.events.toSorted(compareEvents);
    const candidateStart = Math.max(0, boundary.count - candidates.length);
    const sliceStart = page.startIndex - candidateStart;
    const sliceEnd = page.endIndex - candidateStart;
    const exactWindow = sliceStart >= 0 && sliceEnd <= candidates.length;
    const pageEvents = exactWindow
      ? candidates.slice(sliceStart, sliceEnd)
      : candidates.slice(-Math.min(commentPageSize, candidates.length));
    const actualStartIndex = exactWindow
      ? page.startIndex
      : Math.max(0, boundary.count - pageEvents.length);
    const events = await loadParentContext(pageEvents);
    const firstTimestamp =
      actualStartIndex === 0
        ? (pageEvents[0]?.created_at ?? threadFirstTimestamp)
        : threadFirstTimestamp;

    return {
      events,
      visibleIds: new Set(pageEvents.map((event) => event.id)),
      total: countResult.count,
      startIndex: actualStartIndex,
      endIndex: actualStartIndex + pageEvents.length,
      targetIndex: page.targetIndex,
      firstTimestamp,
      lastTimestamp: latestEvent.created_at,
      availableRelays: Math.max(
        countResult.availableRelays,
        commentResult.availableRelays,
      ),
    };
  }

  async function refresh(
    targetIndex = activeGlobalPostIndex,
    targetEventId = "",
  ): Promise<void> {
    const sequence = ++loadSequence;
    loading = true;
    error = "";
    if (relayUrls.length === 0) {
      loading = false;
      error = "No community relays are configured.";
      return;
    }
    try {
      const [releaseResult, commentPage] = await Promise.all([
        queryAll({
          kinds: [BUZZ_REGISTRY_KINDS.streamMessage],
          "#h": [releaseGroupId],
          "#t": [`plugin:${plugin}`],
          ...(publisher === "" ? {} : { authors: [publisher] }),
          limit: 100,
        }),
        loadCommentPage(targetIndex),
      ]);
      if (sequence !== loadSequence) return;
      const nextRelease = releaseResult.events.toSorted(compareEvents).at(-1);
      const visiblePostIds = [...commentPage.visibleIds];
      const reactionTargets = [
        ...visiblePostIds,
        ...(nextRelease === undefined ? [] : [nextRelease.id]),
      ];
      const reactionEvents =
        reactionTargets.length === 0
          ? []
          : (
              await queryAll({
                kinds: [BUZZ_REGISTRY_KINDS.reaction],
                "#e": reactionTargets,
                limit: Math.min(1_000, reactionTargets.length * 25),
              })
            ).events;
      if (sequence !== loadSequence) return;
      const nextReviews = materializeBuzzForum(
        commentPage.events,
        supportGroupId,
      );
      const nextReactions = materializeBuzzReactions(
        reactionEvents,
        new Set(visiblePostIds),
      );
      const nextPluginReactions =
        nextRelease === undefined
          ? []
          : materializeBuzzReactions(
              reactionEvents,
              new Set([nextRelease.id]),
            ).filter(
              (reaction) => !["✅", "❌", "🚫"].includes(reaction.content),
            );
      const authors = [
        ...new Set([
          ...nextReviews.map((review) => review.event.pubkey),
          ...nextReactions.map((reaction) => reaction.event.pubkey),
          ...nextPluginReactions.map((reaction) => reaction.event.pubkey),
        ]),
      ];
      const profileEvents =
        authors.length === 0
          ? []
          : (
              await queryAll({
                kinds: [0],
                authors,
                limit: authors.length,
              })
            ).events;
      if (sequence !== loadSequence) return;

      allReviews = nextReviews;
      reactions = nextReactions;
      pluginRelease = nextRelease;
      pluginReactions = nextPluginReactions;
      visibleReviewIds = commentPage.visibleIds;
      commentTotal = commentPage.total;
      pageStartIndex = commentPage.startIndex;
      pageEndIndex = commentPage.endIndex;
      threadFirstTimestamp = commentPage.firstTimestamp;
      threadLastTimestamp = commentPage.lastTimestamp;
      profiles = new Map(
        parseProfiles(profileEvents).map((profile) => [
          profile.pubkey,
          profile,
        ]),
      );
      const pageReviews = nextReviews.filter((review) =>
        commentPage.visibleIds.has(review.event.id),
      );
      const targetLocalIndex = Math.max(
        0,
        Math.min(
          commentPage.targetIndex - commentPage.startIndex,
          pageReviews.length - 1,
        ),
      );
      activePostId =
        pageReviews.find((review) => review.event.id === targetEventId)?.event
          .id ??
        pageReviews[targetLocalIndex]?.event.id ??
        pageReviews[0]?.event.id ??
        "";
    } catch (cause) {
      if (sequence !== loadSequence) return;
      error =
        cause instanceof Error
          ? cause.message
          : "The community relay is unavailable. Try again shortly.";
    } finally {
      if (sequence === loadSequence) loading = false;
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
        throw new Error("No Buzz relay accepted the NIP-42 login.");
      }
      signer = connectedSigner;
      signedInPubkey = pubkey;
      selectedPluginReaction = ownPluginReaction?.content ?? "";
      message = "Connected to Buzz with your Nostr signer.";
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
      error = "This plugin does not have an approved Buzz release yet.";
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
        kind: BUZZ_REGISTRY_KINDS.reaction,
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
      await refresh();
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
          ? createBuzzForumRootTemplate(
              supportGroupId,
              comment,
              Math.floor(Date.now() / 1_000),
            )
          : createBuzzForumReplyTemplate(
              supportGroupId,
              replyingReview.rootEventId,
              comment,
              Math.floor(Date.now() / 1_000),
            );
      if (
        replyingReview !== undefined &&
        replyingReview.event.id !== replyingReview.rootEventId
      ) {
        template.tags = [
          ["h", supportGroupId],
          ["e", replyingReview.rootEventId, "", "root"],
          ["e", replyingReview.event.id, "", "reply"],
        ];
      }
      const event = await activeSigner.signEvent(template);
      await publish(event);
      comment = "";
      replyingTo = "";
      message = "Comment published.";
      await refresh(Number.MAX_SAFE_INTEGER, event.id);
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
        kind: BUZZ_REGISTRY_KINDS.reaction,
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
      await refresh();
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

  function parentOf(review: ForumPost): ForumPost | undefined {
    return allReviews.find((entry) => entry.event.id === review.parentEventId);
  }

  function postNumber(eventId: string): number {
    const index = reviews.findIndex((review) => review.event.id === eventId);
    return index === -1 ? 0 : pageStartIndex + index + 1;
  }

  function postReference(review: ForumPost): string {
    const number = postNumber(review.event.id);
    return number === 0
      ? formatShortDate(review.event.created_at)
      : `#${number}`;
  }

  function shortKey(value: string): string {
    return value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-8)}`
      : value;
  }

  function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(timestamp * 1_000);
  }

  function formatShortDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(timestamp * 1_000);
  }

  function scrollToPost(eventId: string): void {
    activePostId = eventId;
    postElements
      .get(eventId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function navigateTimelineToIndex(
    index: number,
    rememberOrigin = true,
    targetEventId = "",
  ): Promise<void> {
    if (commentTotal === 0) return;
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
      timelinePreviewIndex = undefined;
      scrollToPost(localTarget.event.id);
      return;
    }
    if (rememberOrigin && timelineReturnIndex === undefined) {
      timelineReturnIndex = activeGlobalPostIndex;
    }
    timelinePreviewIndex = undefined;
    await refresh(targetIndex, targetEventId);
    requestAnimationFrame(() => {
      if (activePostId !== "") scrollToPost(activePostId);
    });
  }

  async function navigateToReview(review: ForumPost): Promise<void> {
    if (visibleReviewIds.has(review.event.id)) {
      scrollToPost(review.event.id);
      return;
    }
    const result = await countAll({
      kinds: [BUZZ_REGISTRY_KINDS.forumRoot, BUZZ_REGISTRY_KINDS.forumReply],
      "#h": [supportGroupId],
      until: review.event.created_at,
    });
    if (result.availableRelays === 0) return;
    await navigateTimelineToIndex(
      Math.max(0, result.count - 1),
      true,
      review.event.id,
    );
  }

  function timelineIndexForPointer(clientY: number): number {
    const bounds = timelineElement?.getBoundingClientRect();
    if (bounds === undefined) return activeGlobalPostIndex;
    return timelineIndexFromPosition(
      clientY - bounds.top - timelineDragOffset,
      bounds.height,
      commentTotal,
      timelineHandleElement?.getBoundingClientRect().height ?? 50,
    );
  }

  function startTimelineDrag(event: PointerEvent): void {
    if (event.button !== 0 || commentTotal < 2 || loading) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".history-back") !== null) {
      return;
    }
    const handleBounds = timelineHandleElement?.getBoundingClientRect();
    timelineDragOffset =
      target instanceof Element &&
      target.closest(".history-handle") !== null &&
      handleBounds !== undefined
        ? event.clientY - (handleBounds.top + handleBounds.height / 2)
        : 0;
    timelineDragging = true;
    timelinePointerId = event.pointerId;
    timelineElement?.setPointerCapture(event.pointerId);
    timelinePreviewIndex = timelineIndexForPointer(event.clientY);
    event.preventDefault();
  }

  function moveTimelineDrag(event: PointerEvent): void {
    if (!timelineDragging || event.pointerId !== timelinePointerId) return;
    timelinePreviewIndex = timelineIndexForPointer(event.clientY);
    event.preventDefault();
  }

  function finishTimelineDrag(event: PointerEvent): void {
    if (!timelineDragging || event.pointerId !== timelinePointerId) return;
    const targetIndex = timelineIndexForPointer(event.clientY);
    timelineElement?.releasePointerCapture(event.pointerId);
    timelineDragging = false;
    timelinePointerId = undefined;
    timelineDragOffset = 0;
    timelinePreviewIndex = undefined;
    void navigateTimelineToIndex(targetIndex);
  }

  function cancelTimelineDrag(event: PointerEvent): void {
    if (event.pointerId !== timelinePointerId) return;
    timelineDragging = false;
    timelinePointerId = undefined;
    timelineDragOffset = 0;
    timelinePreviewIndex = undefined;
  }

  function handleTimelineKey(event: KeyboardEvent): void {
    let targetIndex = activeGlobalPostIndex;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") targetIndex -= 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight")
      targetIndex += 1;
    else if (event.key === "PageUp") targetIndex -= commentPageSize;
    else if (event.key === "PageDown") targetIndex += commentPageSize;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = commentTotal - 1;
    else return;
    event.preventDefault();
    void navigateTimelineToIndex(targetIndex);
  }

  function returnToTimelineOrigin(): void {
    const target = timelineReturnIndex;
    timelineReturnIndex = undefined;
    if (target !== undefined) void navigateTimelineToIndex(target, false);
  }

  function observePost(node: HTMLElement, eventId: string) {
    postElements.set(eventId, node);
    observer?.observe(node);
    return {
      destroy() {
        observer?.unobserve(node);
        postElements.delete(eventId);
      },
    };
  }

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .toSorted(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          );
        const id = (visible[0]?.target as HTMLElement | undefined)?.dataset
          .postId;
        if (id !== undefined) activePostId = id;
      },
      { rootMargin: "-12% 0px -62% 0px", threshold: [0.1, 0.35, 0.7] },
    );
    for (const element of postElements.values()) observer.observe(element);
    void refresh(0);
    return () => {
      observer?.disconnect();
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
          NIP-29 forum posts, replies, and reactions read directly from Buzz.
        </Card.Description>
      </div>
      <Badge
        variant={loading ? "secondary" : error ? "destructive" : "outline"}
      >
        {loading
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

      <div class="discussion" aria-busy={loading}>
        <div class="topic-column">
          <div class="comments-heading">
            <div>
              <h3>Discussion</h3>
              <p>
                {#if commentTotal === 0}
                  Follow the conversation in posting order.
                {:else}
                  Showing posts {displayedPostStart}–{displayedPostEnd} of {commentTotal}.
                  Move the history slider to load another window.
                {/if}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
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
            <ol class="post-stream">
              {#each reviews as review, index (review.event.id)}
                {@const authorName = displayName(review.event.pubkey, profiles)}
                {@const parent = parentOf(review)}
                {@const groups = reactionGroups(review.event.id, reactions)}
                <li>
                  <article
                    id={`post-${review.event.id}`}
                    class:active={review.event.id === activePostId}
                    data-post-id={review.event.id}
                    use:observePost={review.event.id}
                    aria-labelledby={`post-author-${review.event.id}`}
                  >
                    <div
                      class="avatar"
                      style={`--avatar-hue: ${avatarHue(review.event.pubkey)}`}
                      aria-hidden="true"
                    >
                      {initials(authorName)}
                    </div>
                    <div class="post-content">
                      <header class="post-header">
                        <div class="post-author-line">
                          <strong id={`post-author-${review.event.id}`}
                            >{authorName}</strong
                          >
                          {#if parent}
                            <button
                              class="reply-context"
                              onclick={() => navigateToReview(parent)}
                            >
                              ↪ replying to {displayName(
                                parent.event.pubkey,
                                profiles,
                              )} · {postReference(parent)}
                            </button>
                          {/if}
                        </div>
                        <a
                          href={`#post-${review.event.id}`}
                          aria-label={`Link to post ${postNumber(review.event.id)}`}
                        >
                          <time
                            datetime={new Date(
                              review.event.created_at * 1_000,
                            ).toISOString()}
                          >
                            {formatDate(review.event.created_at)}
                          </time>
                        </a>
                      </header>
                      <div class="post-body">
                        {#each review.content.split("\n") as paragraph}
                          {#if paragraph.trim() !== ""}<p>{paragraph}</p>{/if}
                        {/each}
                      </div>
                      <footer class="post-footer">
                        <div
                          class="reaction-list"
                          aria-label={`Reactions to post ${postNumber(review.event.id)}`}
                        >
                          {#each groups as group (`${review.event.id}:${group.content}`)}
                            <Button
                              class="reaction-chip"
                              variant="outline"
                              size="xs"
                              disabled={publishing}
                              aria-label={`React ${group.symbol}; ${group.count} existing`}
                              onclick={() =>
                                submitReaction(review, group.content)}
                            >
                              <span aria-hidden="true">{group.symbol}</span>
                              <span>{group.count}</span>
                            </Button>
                          {/each}
                        </div>
                        <div class="post-actions">
                          {#if !groups.some((group) => group.content === "+")}
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={publishing}
                              aria-label={`Like post ${postNumber(review.event.id)}`}
                              onclick={() => submitReaction(review)}
                              >♡ Like</Button
                            >
                          {/if}
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={publishing}
                            onclick={() => startReply(review)}>↩ Reply</Button
                          >
                        </div>
                      </footer>
                    </div>
                  </article>
                </li>
              {/each}
            </ol>
          {/if}
        </div>

        {#if commentTotal > 1 && threadFirstTimestamp > 0 && threadLastTimestamp > 0}
          <aside class="history" aria-label="Discussion history">
            <div class="history-sticky">
              <button
                class="history-date"
                aria-label="Go to the first post"
                onclick={() => navigateTimelineToIndex(0)}
              >
                <time
                  datetime={new Date(
                    threadFirstTimestamp * 1_000,
                  ).toISOString()}
                >
                  {formatShortDate(threadFirstTimestamp)}
                </time>
              </button>
              <div
                class="history-track"
                class:dragging={timelineDragging}
                role="group"
                aria-label="Discussion timeline"
                bind:this={timelineElement}
                onpointerdown={startTimelineDrag}
                onpointermove={moveTimelineDrag}
                onpointerup={finishTimelineDrag}
                onpointercancel={cancelTimelineDrag}
              >
                <span class="history-line" aria-hidden="true"></span>
                {#if timelineReturnIndex !== undefined && timelineReturnIndex !== activeGlobalPostIndex}
                  <button
                    class="history-back"
                    style={`--timeline-return-position: ${timelinePosition(timelineReturnIndex, commentTotal) / 100}`}
                    aria-label={`Back to post ${timelineReturnIndex + 1}`}
                    onpointerdown={(event) => event.stopPropagation()}
                    onclick={returnToTimelineOrigin}
                  >
                    <span aria-hidden="true"></span>
                    Back
                  </button>
                {/if}
                <div
                  class="history-handle"
                  class:dragging={timelineDragging}
                  style={`--timeline-position: ${timelinePosition(timelineDisplayIndex, commentTotal) / 100}`}
                  bind:this={timelineHandleElement}
                  role="slider"
                  tabindex="0"
                  aria-label="Discussion position"
                  aria-valuemin="1"
                  aria-valuemax={commentTotal}
                  aria-valuenow={timelineDisplayIndex + 1}
                  aria-valuetext={`Post ${timelineDisplayIndex + 1} of ${commentTotal}, ${formatShortDate(timelineDisplayTimestamp)}`}
                  onkeydown={handleTimelineKey}
                >
                  <span class="history-handle-bar" aria-hidden="true"></span>
                  <span class="history-current">
                    <strong>{timelineDisplayIndex + 1} / {commentTotal}</strong>
                    <span>{formatShortDate(timelineDisplayTimestamp)}</span>
                  </span>
                </div>
              </div>
              <button
                class="history-date"
                aria-label="Go to the latest post"
                onclick={() => navigateTimelineToIndex(commentTotal - 1)}
              >
                <time
                  datetime={new Date(threadLastTimestamp * 1_000).toISOString()}
                >
                  {formatShortDate(threadLastTimestamp)}
                </time>
              </button>
            </div>
          </aside>
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
  .actions,
  .post-header,
  .post-footer,
  .post-actions,
  .reaction-list {
    display: flex;
    align-items: center;
  }

  :global(.community-header),
  .comments-heading,
  .composer-heading,
  .form-footer,
  .post-header,
  .post-footer {
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

  .actions,
  .post-actions,
  .reaction-list {
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

  .post-stream {
    margin: 1.25rem 0 0;
    padding: 0;
    list-style: none;
  }

  .post-stream li {
    border-top: 1px solid var(--border);
  }

  article {
    display: grid;
    grid-template-columns: 2.8rem minmax(0, 1fr);
    gap: 0.9rem;
    padding: 1.4rem 0.35rem;
    scroll-margin-top: calc(56px + 1.5rem);
    transition: background-color 160ms ease;
  }

  article.active {
    background: linear-gradient(
      90deg,
      color-mix(in oklch, var(--primary) 10%, transparent),
      transparent 70%
    );
  }

  .avatar {
    display: grid;
    width: 2.65rem;
    height: 2.65rem;
    place-items: center;
    border: 1px solid hsl(var(--avatar-hue) 55% 55% / 0.48);
    border-radius: 50%;
    background: hsl(var(--avatar-hue) 42% 28%);
    color: hsl(var(--avatar-hue) 70% 90%);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .post-content {
    min-width: 0;
  }

  .post-header {
    align-items: flex-start;
  }

  .post-header a {
    flex-shrink: 0;
    color: var(--muted-foreground);
    font-size: 0.73rem;
    text-decoration: none;
  }

  .post-header a:hover {
    color: var(--foreground);
  }

  .post-author-line {
    display: grid;
    gap: 0.2rem;
  }

  .reply-context {
    width: fit-content;
    max-width: 100%;
    padding: 0.3rem 0.55rem;
    overflow: hidden;
    border: 0;
    border-left: 2px solid
      color-mix(in oklch, var(--primary) 66%, var(--border));
    border-radius: 0 0.35rem 0.35rem 0;
    background: color-mix(in oklch, var(--secondary) 72%, transparent);
    color: var(--muted-foreground);
    cursor: pointer;
    font: inherit;
    font-size: 0.72rem;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reply-context:hover {
    color: var(--primary);
  }

  .post-body {
    padding: 0.65rem 0 0.8rem;
    color: color-mix(in oklch, var(--foreground) 94%, var(--muted-foreground));
    font-size: 0.94rem;
    line-height: 1.65;
  }

  .post-body p {
    margin: 0;
  }

  .post-body p + p {
    margin-top: 0.8rem;
  }

  .post-footer {
    min-height: 2rem;
  }

  :global(.reaction-chip) {
    min-width: 2.8rem;
    border-radius: 999px;
  }

  .history-sticky {
    position: sticky;
    top: calc(56px + 2.5rem);
    display: grid;
    grid-template-rows: auto clamp(10.625rem, 45vh, 18.75rem) auto;
    gap: 0.35rem;
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  .history-date {
    width: fit-content;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    font: inherit;
    line-height: 1.25rem;
  }

  .history-date:hover,
  .history-date:focus-visible {
    color: var(--foreground);
  }

  .history-track {
    --timeline-handle-height: 3.125rem;
    position: relative;
    width: 100%;
    height: 100%;
    cursor: pointer;
    touch-action: none;
    user-select: none;
  }

  .history-track.dragging {
    cursor: grabbing;
  }

  .history-line {
    position: absolute;
    inset: 0 auto 0 0.45rem;
    width: 1px;
    background: var(--border);
  }

  .history-handle {
    position: absolute;
    z-index: 2;
    top: calc(
      (100% - var(--timeline-handle-height)) * var(--timeline-position)
    );
    right: 0;
    left: 0;
    display: grid;
    grid-template-columns: 1rem minmax(0, 1fr);
    align-items: center;
    height: var(--timeline-handle-height);
    color: var(--foreground);
    cursor: grab;
    outline: none;
    transition: top 180ms ease-out;
  }

  .history-handle.dragging {
    cursor: grabbing;
    transition: none;
  }

  .history-handle-bar {
    width: 0.35rem;
    height: 100%;
    margin-left: 0.28rem;
    border-radius: 999px;
    background: var(--primary);
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--primary) 28%, transparent);
  }

  .history-current {
    display: grid;
    gap: 0.05rem;
    min-width: 0;
    padding: 0.4rem 0.45rem;
    border-radius: var(--radius);
    transition: background-color 150ms ease;
  }

  .history-handle:hover .history-current,
  .history-handle:focus-visible .history-current,
  .history-handle.dragging .history-current {
    background: var(--secondary);
  }

  .history-current strong {
    font-size: 0.9rem;
    line-height: 1rem;
  }

  .history-current span {
    color: var(--muted-foreground);
    line-height: 1rem;
  }

  .history-back {
    position: absolute;
    z-index: 1;
    top: calc(0.75rem + (100% - 1.5rem) * var(--timeline-return-position));
    left: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0.35rem 0.15rem 0;
    border: 0;
    border-radius: 0.25rem;
    background: var(--card);
    color: var(--muted-foreground);
    cursor: pointer;
    font: inherit;
    font-size: 0.7rem;
    transform: translateY(-50%);
  }

  .history-back > span {
    width: 0.9rem;
    height: 1px;
    background: var(--muted-foreground);
  }

  .history-back:hover,
  .history-back:focus-visible {
    color: var(--foreground);
  }

  .history-back:hover > span,
  .history-back:focus-visible > span {
    background: var(--foreground);
  }

  @media (prefers-reduced-motion: reduce) {
    .history-handle {
      transition: none;
    }
  }

  @media (max-width: 62rem) {
    .discussion {
      grid-template-columns: minmax(0, 1fr);
    }

    .history {
      display: none;
    }
  }

  @media (max-width: 44rem) {
    :global(.community-header),
    .comments-heading,
    .composer-heading,
    .form-footer,
    .post-header {
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

    article {
      grid-template-columns: 2.3rem minmax(0, 1fr);
      gap: 0.7rem;
    }

    .avatar {
      width: 2.2rem;
      height: 2.2rem;
      font-size: 0.68rem;
    }

    .post-footer {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
