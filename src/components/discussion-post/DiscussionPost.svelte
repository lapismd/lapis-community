<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";

  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import {
    avatarHue,
    displayName,
    initials,
    type CommunityProfile,
    type ForumPost,
    type ReactionGroup,
  } from "../registry-community/model.js";

  let {
    post,
    parent,
    groups = [],
    profiles,
    number,
    parentReference = "",
    active = false,
    publishing = false,
    onNavigate,
    onReply,
    onReact,
  }: {
    post: ForumPost;
    parent?: ForumPost | undefined;
    groups?: ReactionGroup[];
    profiles: ReadonlyMap<string, CommunityProfile>;
    number: number;
    parentReference?: string;
    active?: boolean;
    publishing?: boolean;
    onNavigate: (post: ForumPost) => void | Promise<void>;
    onReply: (post: ForumPost) => void;
    onReact: (post: ForumPost, content?: string) => void | Promise<void>;
  } = $props();

  const authorName = $derived(displayName(post.event.pubkey, profiles));
  const reactionPresets = ["👍", "❤️", "🎉", "👀", "⭐"] as const;

  function excerpt(value: string, maximum = 96): string {
    const normalized = value.replace(/\s+/gu, " ").trim();
    return normalized.length > maximum
      ? `${normalized.slice(0, maximum - 1).trimEnd()}…`
      : normalized;
  }

  function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(timestamp * 1_000);
  }
</script>

<article class:active aria-labelledby={`post-author-${post.event.id}`}>
  <div
    class="avatar"
    style={`--avatar-hue: ${avatarHue(post.event.pubkey)}`}
    aria-hidden="true"
  >
    {initials(authorName)}
  </div>
  <div class="post-content">
    <header class="post-header">
      <div class="post-author-line">
        <strong id={`post-author-${post.event.id}`}>{authorName}</strong>
        {#if parent}
          <button class="reply-context" onclick={() => onNavigate(parent)}>
            <span>
              ↪ replying to {displayName(parent.event.pubkey, profiles)} · {parentReference}
            </span>
            <span class="reply-context__excerpt">{excerpt(parent.content)}</span
            >
          </button>
        {/if}
      </div>
      <a href={`#post-${post.event.id}`} aria-label={`Link to post ${number}`}>
        <time datetime={new Date(post.event.created_at * 1_000).toISOString()}>
          {formatDate(post.event.created_at)}
        </time>
      </a>
    </header>
    <div class="post-body">
      {#each post.content.split("\n") as paragraph}
        {#if paragraph.trim() !== ""}<p>{paragraph}</p>{/if}
      {/each}
    </div>
    <footer class="post-footer">
      <div
        class="reaction-list"
        role="group"
        aria-label={`Reactions to post ${number}`}
      >
        {#each groups as group (`${post.event.id}:${group.content}`)}
          <Button
            class="reaction-chip"
            variant="outline"
            size="xs"
            disabled={publishing}
            aria-label={`React ${group.symbol}; ${group.count} existing`}
            onclick={() => onReact(post, group.content)}
          >
            <span aria-hidden="true">{group.symbol}</span>
            <span>{group.count}</span>
          </Button>
        {/each}
      </div>
      <div class="post-actions">
        <CommunityEmojiPicker
          label={`React to post ${number}`}
          disabled={publishing}
          presets={reactionPresets}
          onSelect={(emoji) => void onReact(post, emoji)}
        />
        <Button
          variant="ghost"
          size="xs"
          disabled={publishing}
          onclick={() => onReply(post)}>↩ Reply</Button
        >
      </div>
    </footer>
  </div>
</article>

<style>
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

  .post-header,
  .post-footer,
  .post-actions,
  .reaction-list {
    display: flex;
    align-items: center;
  }

  .post-header,
  .post-footer {
    justify-content: space-between;
    gap: 1rem;
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
    display: grid;
    gap: 0.15rem;
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
  }

  .reply-context > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reply-context__excerpt {
    color: var(--foreground);
    font-size: 0.76rem;
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

  .post-actions,
  .reaction-list {
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  :global(.reaction-chip) {
    min-width: 2.8rem;
    border-radius: 999px;
  }

  @media (max-width: 44rem) {
    .post-header {
      align-items: flex-start;
      flex-direction: column;
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
