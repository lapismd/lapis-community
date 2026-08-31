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
    createRatingTemplate,
    materializeCommunity,
    type CommunityKindMap,
    type MaterializedCommunity,
    type NostrEvent,
  } from "@lapismd/registry-protocol";

  import { anyRelayPublished, parseRelayUrls } from "./model.js";

  let {
    plugin = "",
    name = "Plugin",
    version = "",
    address = "",
    publisher = "",
    relays = "[]",
    ratingkind = "64006",
    commentkind = "1111",
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
    applicationkind?: string;
  } = $props();

  let snapshot = $state<MaterializedCommunity | undefined>();
  let signer = $state<RegistrySigner | undefined>();
  let signedInPubkey = $state("");
  let selectedRating = $state("");
  let comment = $state("");
  let loading = $state(true);
  let publishing = $state(false);
  let message = $state("");
  let error = $state("");

  const clients = new Map<string, WebSocketRegistryRelay>();
  const unusedCommunityKinds = Object.freeze({
    report: 1984,
    followList: 3,
    appCurationSet: 30267,
  });

  const relayUrls = $derived.by(() => {
    return parseRelayUrls(relays);
  });

  const kinds = $derived<CommunityKindMap>({
    rating: Number(ratingkind),
    comment: Number(commentkind),
    softwareApplication: Number(applicationkind),
    ...unusedCommunityKinds,
  });

  const aggregate = $derived(
    snapshot?.ratingAggregates.find((entry) => entry.pluginId === plugin),
  );
  const reviews = $derived(
    snapshot?.reviews.filter((entry) => entry.pluginId === plugin) ?? [],
  );
  const ownRating = $derived(
    snapshot?.ratings.find(
      (entry) =>
        entry.event.pubkey === signedInPubkey &&
        entry.content.pluginId === plugin,
    ),
  );

  function relay(url: string): WebSocketRegistryRelay {
    const current = clients.get(url);
    if (current !== undefined) return current;
    const created = new WebSocketRegistryRelay(url);
    clients.set(url, created);
    return created;
  }

  async function refresh(): Promise<void> {
    loading = true;
    error = "";
    if (relayUrls.length === 0) {
      loading = false;
      error = "No community relays are configured.";
      return;
    }
    const results = await Promise.allSettled(
      relayUrls.map(async (url) => {
        return await relay(url).query({
          kinds: [kinds.rating, kinds.comment],
          "#a": [address],
          limit: 500,
        });
      }),
    );
    const successful = results.filter(
      (result): result is PromiseFulfilledResult<NostrEvent[]> =>
        result.status === "fulfilled",
    );
    if (successful.length === 0) {
      loading = false;
      error = "The community relay is unavailable. Try again shortly.";
      return;
    }
    snapshot = materializeCommunity(
      successful.flatMap((result) => result.value),
      kinds,
      new Map([[plugin, address]]),
    );
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

  async function submitRating(status: "active" | "withdrawn"): Promise<void> {
    if (signer === undefined) {
      await connect();
      if (signer === undefined) return;
    }
    const numericRating = Number(selectedRating);
    if (status === "active" && ![1, 2, 3, 4, 5].includes(numericRating)) {
      error = "Choose a rating from one to five stars.";
      return;
    }
    publishing = true;
    error = "";
    message = "";
    try {
      const event = await signer.signEvent(
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
    if (signer === undefined) {
      await connect();
      if (signer === undefined) return;
    }
    publishing = true;
    error = "";
    message = "";
    try {
      const event = await signer.signEvent(
        createPluginCommentTemplate(
          comment,
          {
            pluginAddress: address,
            pluginKind: kinds.softwareApplication,
            publisherPubkey: publisher,
          },
          kinds,
          Math.floor(Date.now() / 1_000),
        ),
      );
      await publish(event);
      comment = "";
      message = "Comment published.";
      await refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Comment failed.";
    } finally {
      publishing = false;
    }
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

  onMount(() => {
    void refresh();
    return () => {
      for (const client of clients.values()) client.close();
      clients.clear();
    };
  });
</script>

<section class="community" aria-labelledby="community-title" data-design-core="0.1.0">
  <Card.Root class="community-card">
    <Card.Header class="community-header">
      <div>
        <Card.Title id="community-title">Community</Card.Title>
        <Card.Description>Ratings and comments live on Nostr.</Card.Description>
      </div>
      <Badge variant={loading ? "secondary" : error ? "destructive" : "outline"}>
        {loading ? "Syncing" : error ? "Relay issue" : `${relayUrls.length} relay${relayUrls.length === 1 ? "" : "s"}`}
      </Badge>
    </Card.Header>

    <Card.Content class="community-content">
      <div class="rating-summary" aria-live="polite">
        <strong>{aggregate?.average?.toFixed(1) ?? "—"}</strong>
        <span aria-hidden="true" class="summary-star">★</span>
        <span>{aggregate?.count ?? 0} rating{aggregate?.count === 1 ? "" : "s"}</span>
      </div>

      <div class="rating-control">
        <span class="field-label" id="rating-label">Your rating</span>
        <ToggleGroup.Root
          type="single"
          variant="outline"
          bind:value={selectedRating}
          aria-labelledby="rating-label"
          disabled={publishing}
        >
          {#each [1, 2, 3, 4, 5] as star}
            <ToggleGroup.Item value={star.toString()} aria-label={`${star} star${star === 1 ? "" : "s"}`}>
              <span aria-hidden="true">★</span>
            </ToggleGroup.Item>
          {/each}
        </ToggleGroup.Root>
        <div class="actions">
          <Button size="sm" disabled={publishing || selectedRating === ""} onclick={() => submitRating("active")}>
            {ownRating ? "Update rating" : "Publish rating"}
          </Button>
          {#if ownRating}
            <Button size="sm" variant="ghost" disabled={publishing} onclick={() => submitRating("withdrawn")}>
              Remove
            </Button>
          {/if}
        </div>
      </div>

      <div class="comment-form">
        <label for="registry-comment">Add a comment</label>
        <Textarea
          id="registry-comment"
          bind:value={comment}
          maxlength={10000}
          rows={4}
          placeholder={`Share your experience with ${name}`}
          disabled={publishing}
        />
        <div class="form-footer">
          <span>{signedInPubkey === "" ? "A NIP-07 signer is required." : shortKey(signedInPubkey)}</span>
          <div class="actions">
            {#if signedInPubkey === ""}
              <Button variant="outline" size="sm" disabled={publishing} onclick={connect}>Connect Nostr</Button>
            {/if}
            <Button size="sm" disabled={publishing || comment.trim() === ""} onclick={submitComment}>
              Publish comment
            </Button>
          </div>
        </div>
      </div>

      {#if error}
        <p class="notice error" role="alert">{error}</p>
      {:else if message}
        <p class="notice" role="status">{message}</p>
      {/if}

      <div class="comments" aria-busy={loading}>
        <div class="comments-heading">
          <h3>Comments</h3>
          <Button variant="ghost" size="sm" disabled={loading} onclick={refresh}>Refresh</Button>
        </div>
        {#if loading}
          <p class="empty">Reading signed events from the relay…</p>
        {:else if reviews.length === 0}
          <p class="empty">No comments yet. Start the conversation.</p>
        {:else}
          <ol>
            {#each reviews as review (review.event.id)}
              <li>
                <div class="comment-meta">
                  <code>{shortKey(review.event.pubkey)}</code>
                  <time datetime={new Date(review.event.created_at * 1_000).toISOString()}>
                    {formatDate(review.event.created_at)}
                  </time>
                </div>
                <p>{review.content}</p>
              </li>
            {/each}
          </ol>
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

  :global(.community-header),
  .comments-heading,
  .form-footer,
  .actions,
  .rating-summary,
  .comment-meta {
    display: flex;
    align-items: center;
  }

  :global(.community-header),
  .comments-heading,
  .form-footer {
    justify-content: space-between;
    gap: 1rem;
  }

  :global(.community-content) {
    display: grid;
    gap: 1.25rem;
  }

  .rating-summary {
    gap: 0.45rem;
    color: var(--muted-foreground);
  }

  .rating-summary strong {
    color: var(--foreground);
    font-size: 2rem;
    line-height: 1;
  }

  .summary-star,
  :global([data-ui-part="toggle-group-item"] span) {
    color: oklch(0.72 0.16 75);
  }

  .rating-control,
  .comment-form {
    display: grid;
    gap: 0.65rem;
  }

  label,
  .field-label,
  h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .actions {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .form-footer {
    color: var(--muted-foreground);
    font-size: 0.8rem;
  }

  .notice,
  .empty {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.9rem;
  }

  .notice {
    border-left: 3px solid var(--primary);
    padding: 0.55rem 0.75rem;
    background: var(--secondary);
  }

  .notice.error {
    border-color: var(--destructive);
  }

  .comments {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }

  ol {
    display: grid;
    gap: 0.75rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.85rem;
    background: color-mix(in oklch, var(--card) 94%, var(--secondary));
  }

  li p {
    margin: 0.5rem 0 0;
    white-space: pre-wrap;
  }

  .comment-meta {
    justify-content: space-between;
    gap: 0.75rem;
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  code {
    font-family: "Source Code Pro", ui-monospace, monospace;
  }

  @media (max-width: 38rem) {
    :global(.community-header),
    .form-footer,
    .comment-meta {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
