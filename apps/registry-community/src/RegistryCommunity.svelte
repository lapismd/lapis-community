<svelte:options customElement={{ shadow: "open" }} />

<script lang="ts">
  import { onMount } from "svelte";

  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Card from "@lapismd/design-core/shadcn/card";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import {
    Nip07RegistrySigner,
    type RegistrySigner,
  } from "@lapismd/registry-auth";
  import { WebSocketRegistryRelay } from "@lapismd/registry-nostr";
  import {
    createPluginCommentTemplate,
    createPluginReplyTemplate,
    createRatingTemplate,
    createReactionTemplate,
    materializeCommunity,
    type CommunityKindMap,
    type MaterializedCommunity,
    type MaterializedReview,
    type NostrEvent,
  } from "@lapismd/registry-protocol";

  import {
    anyRelayPublished,
    avatarHue,
    displayName,
    initials,
    parseProfiles,
    parseRelayUrls,
    reactionGroups,
    timelinePosition,
    type CommunityProfile,
  } from "./model.js";

  let {
    plugin = "",
    name = "Plugin",
    version = "",
    address = "",
    publisher = "",
    relays = "[]",
    ratingkind = "64006",
    commentkind = "1111",
    reactionkind = "7",
    applicationkind = "32267",
  }: {
    plugin?: string;
    name?: string;
    version?: string;
    address?: string;
    publisher?: string;
    relays?: string;
    ratingkind?: string;
    commentkind?: string;
    reactionkind?: string;
    applicationkind?: string;
  } = $props();

  let snapshot = $state<MaterializedCommunity | undefined>();
  let profiles = $state<ReadonlyMap<string, CommunityProfile>>(new Map());
  let signer = $state<RegistrySigner | undefined>();
  let signedInPubkey = $state("");
  let selectedRating = $state("");
  let comment = $state("");
  let replyingTo = $state("");
  let activePostId = $state("");
  let loading = $state(true);
  let publishing = $state(false);
  let message = $state("");
  let error = $state("");
  let composerElement: HTMLDivElement | undefined;
  let observer: IntersectionObserver | undefined;

  const clients = new Map<string, WebSocketRegistryRelay>();
  const postElements = new Map<string, HTMLElement>();
  const unusedCommunityKinds = Object.freeze({
    report: 1984,
    followList: 3,
    appCurationSet: 30267,
  });

  const relayUrls = $derived(parseRelayUrls(relays));
  const kinds = $derived<CommunityKindMap>({
    rating: Number(ratingkind),
    comment: Number(commentkind),
    reaction: Number(reactionkind),
    softwareApplication: Number(applicationkind),
    ...unusedCommunityKinds,
  });
  const aggregate = $derived(
    snapshot?.ratingAggregates.find((entry) => entry.pluginId === plugin),
  );
  const reviews = $derived(
    snapshot?.reviews.filter((entry) => entry.pluginId === plugin) ?? [],
  );
  const reactions = $derived(
    snapshot?.reactions.filter((entry) => entry.pluginId === plugin) ?? [],
  );
  const ownRating = $derived(
    snapshot?.ratings.find(
      (entry) =>
        entry.event.pubkey === signedInPubkey &&
        entry.content.pluginId === plugin,
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
  const participantCount = $derived.by(
    () =>
      new Set([
        ...reviews.map((review) => review.event.pubkey),
        ...reactions.map((reaction) => reaction.event.pubkey),
      ]).size,
  );

  function relay(url: string): WebSocketRegistryRelay {
    const current = clients.get(url);
    if (current !== undefined) return current;
    const created = new WebSocketRegistryRelay(url);
    clients.set(url, created);
    return created;
  }

  async function queryAll(
    filter: Parameters<WebSocketRegistryRelay["query"]>[0],
  ): Promise<{ events: NostrEvent[]; availableRelays: number }> {
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => await relay(url).query(filter)),
    );
    const successful = results.filter(
        (result): result is PromiseFulfilledResult<NostrEvent[]> =>
          result.status === "fulfilled",
      );
    return {
      events: successful.flatMap((result) => result.value),
      availableRelays: successful.length,
    };
  }

  async function refresh(): Promise<void> {
    loading = true;
    error = "";
    if (relayUrls.length === 0) {
      loading = false;
      error = "No community relays are configured.";
      return;
    }
    const [ratingResult, commentResult] = await Promise.all([
      queryAll({
        kinds: [kinds.rating],
        "#a": [address],
        limit: 500,
      }),
      queryAll({
        kinds: [kinds.comment],
        "#A": [address],
        limit: 500,
      }),
    ]);
    if (ratingResult.availableRelays === 0 && commentResult.availableRelays === 0) {
      loading = false;
      error = "The community relay is unavailable. Try again shortly.";
      return;
    }
    const primaryEvents = [...ratingResult.events, ...commentResult.events];
    const primary = materializeCommunity(
      primaryEvents,
      kinds,
      new Map([[plugin, address]]),
    );
    const postIds = primary.reviews.map((review) => review.event.id);
    const reactionEvents =
      postIds.length === 0
        ? []
        : (
            await queryAll({
              kinds: [kinds.reaction],
              "#e": postIds,
              limit: 1_000,
            })
          ).events;
    snapshot = materializeCommunity(
      [...primaryEvents, ...reactionEvents],
      kinds,
      new Map([[plugin, address]]),
    );
    const authors = [
      ...new Set([
        ...snapshot.reviews.map((review) => review.event.pubkey),
        ...snapshot.reactions.map((reaction) => reaction.event.pubkey),
      ]),
    ];
    if (authors.length > 0) {
      const profileEvents = (
        await queryAll({
          kinds: [0],
          authors,
          limit: authors.length,
        })
      ).events;
      profiles = new Map(
        parseProfiles(profileEvents).map((profile) => [profile.pubkey, profile]),
      );
    }
    if (
      activePostId === "" ||
      !snapshot.reviews.some((review) => review.event.id === activePostId)
    ) {
      activePostId = snapshot.reviews[0]?.event.id ?? "";
    }
    loading = false;
  }

  async function connect(): Promise<void> {
    error = "";
    message = "";
    try {
      signer = new Nip07RegistrySigner();
      signedInPubkey = await signer.getPublicKey();
      selectedRating = ownRating?.content.rating.toString() ?? "";
      message = "Connected with your Nostr signer.";
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
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => await relay(url).publish(event)),
    );
    if (!anyRelayPublished(results)) {
      throw new Error("No community relay accepted the signed event.");
    }
  }

  async function ensureSigner(): Promise<RegistrySigner | undefined> {
    if (signer === undefined) await connect();
    return signer;
  }

  async function submitRating(status: "active" | "withdrawn"): Promise<void> {
    const activeSigner = await ensureSigner();
    if (activeSigner === undefined) return;
    const numericRating = Number(selectedRating);
    if (status === "active" && ![1, 2, 3, 4, 5].includes(numericRating)) {
      error = "Choose a rating from one to five stars.";
      return;
    }
    publishing = true;
    error = "";
    message = "";
    try {
      const event = await activeSigner.signEvent(
        createRatingTemplate(
          {
            schema: "lapis.registry.rating/1",
            pluginId: plugin,
            rating: (status === "withdrawn"
              ? (ownRating?.content.rating ?? 1)
              : numericRating) as 1 | 2 | 3 | 4 | 5,
            status,
            ...(version === "" ? {} : { version }),
          },
          address,
          kinds,
          Math.floor(Date.now() / 1_000),
        ),
      );
      await publish(event);
      message = status === "active" ? "Rating published." : "Rating removed.";
      if (status === "withdrawn") selectedRating = "";
      await refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Rating failed.";
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
      const target = {
        pluginAddress: address,
        pluginKind: kinds.softwareApplication,
        publisherPubkey: publisher,
      };
      const template =
        replyingReview === undefined
          ? createPluginCommentTemplate(
              comment,
              target,
              kinds,
              Math.floor(Date.now() / 1_000),
            )
          : createPluginReplyTemplate(
              comment,
              {
                ...target,
                parentEventId: replyingReview.event.id,
                parentPubkey: replyingReview.event.pubkey,
              },
              kinds,
              Math.floor(Date.now() / 1_000),
            );
      await publish(await activeSigner.signEvent(template));
      comment = "";
      replyingTo = "";
      message = "Comment published.";
      await refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Comment failed.";
    } finally {
      publishing = false;
    }
  }

  async function submitReaction(
    review: MaterializedReview,
    content = "+",
  ): Promise<void> {
    const activeSigner = await ensureSigner();
    if (activeSigner === undefined) return;
    publishing = true;
    error = "";
    message = "";
    try {
      const event = await activeSigner.signEvent(
        createReactionTemplate(
          content,
          {
            eventId: review.event.id,
            eventKind: review.event.kind,
            eventPubkey: review.event.pubkey,
          },
          kinds,
          Math.floor(Date.now() / 1_000),
        ),
      );
      await publish(event);
      message = "Reaction published.";
      await refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Reaction failed.";
    } finally {
      publishing = false;
    }
  }

  function startReply(review: MaterializedReview): void {
    replyingTo = review.event.id;
    requestAnimationFrame(() =>
      composerElement?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  function parentOf(review: MaterializedReview): MaterializedReview | undefined {
    return reviews.find((entry) => entry.event.id === review.parentEventId);
  }

  function postNumber(eventId: string): number {
    return reviews.findIndex((review) => review.event.id === eventId) + 1;
  }

  function shortKey(value: string): string {
    return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
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
      year: "numeric",
    }).format(timestamp * 1_000);
  }

  function scrollToPost(eventId: string): void {
    activePostId = eventId;
    postElements
      .get(eventId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          .toSorted((left, right) => right.intersectionRatio - left.intersectionRatio);
        const id = (visible[0]?.target as HTMLElement | undefined)?.dataset.postId;
        if (id !== undefined) activePostId = id;
      },
      { rootMargin: "-12% 0px -62% 0px", threshold: [0.1, 0.35, 0.7] },
    );
    for (const element of postElements.values()) observer.observe(element);
    void refresh();
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
>
  <Card.Root class="community-card">
    <Card.Header class="community-header">
      <div>
        <Card.Title id="community-title">{name} community discussion</Card.Title>
        <Card.Description>
          Signed comments, replies, ratings, and reactions read directly from Nostr.
        </Card.Description>
      </div>
      <Badge variant={loading ? "secondary" : error ? "destructive" : "outline"}>
        {loading
          ? "Syncing"
          : error
            ? "Relay issue"
            : `${relayUrls.length} relay${relayUrls.length === 1 ? "" : "s"}`}
      </Badge>
    </Card.Header>

    <Card.Content class="community-content">
      <div class="topic-summary" aria-live="polite">
        <div><strong>{reviews.length}</strong><span>posts</span></div>
        <div><strong>{reactions.length}</strong><span>reactions</span></div>
        <div><strong>{participantCount}</strong><span>participants</span></div>
        <div>
          <strong>{aggregate?.average?.toFixed(1) ?? "—"}<span aria-hidden="true">★</span></strong>
          <span>{aggregate?.count ?? 0} ratings</span>
        </div>
      </div>

      <div class="rating-control">
        <div>
          <span class="field-label" id="rating-label">Your rating</span>
          <p>Publish or update a signed rating for this plugin.</p>
        </div>
        <ToggleGroup.Root
          type="single"
          variant="outline"
          bind:value={selectedRating}
          aria-labelledby="rating-label"
          disabled={publishing}
        >
          {#each [1, 2, 3, 4, 5] as star}
            <ToggleGroup.Item
              value={star.toString()}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
            >
              <span aria-hidden="true">★</span>
            </ToggleGroup.Item>
          {/each}
        </ToggleGroup.Root>
        <div class="actions">
          <Button
            size="sm"
            disabled={publishing || selectedRating === ""}
            onclick={() => submitRating("active")}
          >
            {ownRating ? "Update rating" : "Publish rating"}
          </Button>
          {#if ownRating}
            <Button
              size="sm"
              variant="ghost"
              disabled={publishing}
              onclick={() => submitRating("withdrawn")}
            >Remove</Button>
          {/if}
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
              <p>Follow the conversation in posting order.</p>
            </div>
            <Button variant="ghost" size="sm" disabled={loading} onclick={refresh}>
              Refresh
            </Button>
          </div>

          <div class="comment-form" bind:this={composerElement}>
            <div class="composer-heading">
              <div>
                <span class="field-label">
                  {replyingReview === undefined ? "Add to the discussion" : "Reply to a post"}
                </span>
                {#if replyingReview}
                  <p>
                    Replying to {displayName(replyingReview.event.pubkey, profiles)} · post
                    #{postNumber(replyingReview.event.id)}
                  </p>
                {:else}
                  <p>Post a top-level comment about {name}.</p>
                {/if}
              </div>
              {#if replyingReview}
                <Button variant="ghost" size="sm" onclick={() => (replyingTo = "")}>Cancel</Button>
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
                    onclick={connect}
                  >Connect Nostr</Button>
                {/if}
                <Button
                  size="sm"
                  disabled={publishing || comment.trim() === ""}
                  onclick={submitComment}
                >{replyingReview ? "Publish reply" : "Publish comment"}</Button>
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
                    >{initials(authorName)}</div>
                    <div class="post-content">
                      <header class="post-header">
                        <div class="post-author-line">
                          <strong id={`post-author-${review.event.id}`}>{authorName}</strong>
                          {#if parent}
                            <button class="reply-context" onclick={() => scrollToPost(parent.event.id)}>
                              ↪ replying to {displayName(parent.event.pubkey, profiles)} · #{postNumber(parent.event.id)}
                            </button>
                          {/if}
                        </div>
                        <a href={`#post-${review.event.id}`} aria-label={`Link to post ${index + 1}`}>
                          <time datetime={new Date(review.event.created_at * 1_000).toISOString()}>
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
                        <div class="reaction-list" aria-label={`Reactions to post ${index + 1}`}>
                          {#each groups as group (`${review.event.id}:${group.content}`)}
                            <Button
                              class="reaction-chip"
                              variant="outline"
                              size="xs"
                              disabled={publishing}
                              aria-label={`React ${group.symbol}; ${group.count} existing`}
                              onclick={() => submitReaction(review, group.content)}
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
                              aria-label={`Like post ${index + 1}`}
                              onclick={() => submitReaction(review)}
                            >♡ Like</Button>
                          {/if}
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={publishing}
                            onclick={() => startReply(review)}
                          >↩ Reply</Button>
                        </div>
                      </footer>
                    </div>
                  </article>
                </li>
              {/each}
            </ol>
          {/if}
        </div>

        {#if reviews.length > 1}
          <aside class="history" aria-label="Discussion history">
            <div class="history-sticky">
              <time datetime={new Date(reviews[0]!.event.created_at * 1_000).toISOString()}>
                {formatShortDate(reviews[0]!.event.created_at)}
              </time>
              <div class="history-track">
                <span
                  class="history-progress"
                  style={`height: ${timelinePosition(activePostIndex, reviews.length)}%`}
                ></span>
                {#each reviews as review, index (review.event.id)}
                  <button
                    class:active={review.event.id === activePostId}
                    style={`top: ${timelinePosition(index, reviews.length)}%`}
                    aria-label={`Go to post ${index + 1}`}
                    onclick={() => scrollToPost(review.event.id)}
                  ></button>
                {/each}
              </div>
              <button class="history-current" onclick={() => scrollToPost(activePostId)}>
                <strong>{activePostIndex + 1} / {reviews.length}</strong>
                <span>{formatShortDate(reviews[activePostIndex]!.event.created_at)}</span>
              </button>
              <time datetime={new Date(reviews.at(-1)!.event.created_at * 1_000).toISOString()}>
                {formatShortDate(reviews.at(-1)!.event.created_at)}
              </time>
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

  .topic-summary strong span {
    margin-left: 0.2rem;
    color: oklch(0.76 0.16 75);
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
    grid-template-columns: minmax(0, 1fr) 8.5rem;
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
    scroll-margin-top: 1.5rem;
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
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    font: inherit;
    font-size: 0.72rem;
    text-align: left;
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
    top: 1rem;
    display: grid;
    grid-template-rows: auto 17rem auto auto;
    justify-items: center;
    gap: 0.65rem;
    padding-top: 0.25rem;
    color: var(--muted-foreground);
    font-size: 0.7rem;
  }

  .history-track {
    position: relative;
    width: 2px;
    height: 17rem;
    background: var(--border);
  }

  .history-progress {
    position: absolute;
    inset: 0 0 auto;
    background: var(--primary);
  }

  .history-track button {
    position: absolute;
    left: 50%;
    width: 0.45rem;
    height: 0.45rem;
    padding: 0;
    border: 1px solid var(--card);
    border-radius: 50%;
    background: var(--muted-foreground);
    cursor: pointer;
    transform: translate(-50%, -50%);
  }

  .history-track button.active {
    width: 0.75rem;
    height: 0.75rem;
    background: var(--primary);
    box-shadow: 0 0 0 4px color-mix(in oklch, var(--primary) 22%, transparent);
  }

  .history-current {
    display: grid;
    gap: 0.1rem;
    width: 100%;
    padding: 0.5rem 0.35rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--secondary);
    color: var(--foreground);
    cursor: pointer;
    font: inherit;
  }

  .history-current strong {
    font-size: 0.84rem;
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
