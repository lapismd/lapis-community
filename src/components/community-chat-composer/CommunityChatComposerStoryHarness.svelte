<script lang="ts">
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityChatComposer from "./CommunityChatComposer.svelte";
  import type { CommunityComposerSubmission } from "./model.js";
  import {
    communityComposerStoryEmojis,
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "./story-fixtures.js";

  let value = $state(
    "Thanks @Ben Stone — I added the details to #plugin-development with :lapis:.",
  );
  let submission = $state<CommunityComposerSubmission>();

  function submit(next: CommunityComposerSubmission): void {
    submission = next;
  }
</script>

<div class="community-chat-composer-story-harness">
  <CommunityChatComposer
    bind:value
    members={communityComposerStoryMembers}
    rooms={communityComposerStoryRooms}
    communityEmojis={communityComposerStoryEmojis}
    currentMemberId="ada"
    onSubmit={submit}
  />

  {#if submission}
    <article aria-label="Sent message preview">
      <header>
        <span>AL</span>
        <div><strong>Ada Lovelace</strong><small>just now</small></div>
      </header>
      <CommunityMarkdownContent
        content={submission.content}
        mentionPubkeys={submission.mentionPubkeys}
        members={communityComposerStoryMembers}
        rooms={communityComposerStoryRooms}
        communityEmojis={communityComposerStoryEmojis}
      />
    </article>
  {/if}
</div>

<style>
  .community-chat-composer-story-harness {
    display: grid;
    width: min(48rem, calc(100vw - 4rem));
    gap: 1.25rem;
  }

  article {
    display: grid;
    gap: 0.45rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: var(--background);
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  header > span {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 14%, var(--muted));
    color: var(--primary);
    font-size: var(--community-text-secondary);
    font-weight: 700;
  }

  header div {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  header strong {
    font-size: var(--community-text-secondary);
  }

  header small {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
</style>
