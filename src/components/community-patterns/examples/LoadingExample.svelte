<script lang="ts">
  import { onMount } from "svelte";
  import {
    CommunitySkeleton,
    CommunityMessage,
  } from "@lapismd/lapis-community/components";
  import { Button } from "@lapismd/design-core/shadcn/button";
  let { outcome = "content" }: { outcome?: "content" | "empty" | "error" } =
    $props();
  let loading = $state(true),
    refreshing = $state(false),
    older = $state(false),
    count = $state(1);
  const author = {
    id: "avery",
    name: "Avery",
    handle: "avery",
    initials: "AV",
  };
  onMount(() => {
    const timeout = setTimeout(() => {
      loading = false;
    }, 1000);
    return () => clearTimeout(timeout);
  });
  async function refresh() {
    refreshing = true;
    await new Promise((resolve) => setTimeout(resolve, 350));
    refreshing = false;
  }
  async function loadOlder() {
    older = true;
    await new Promise((resolve) => setTimeout(resolve, 350));
    count += 1;
    older = false;
  }
</script>

<div class="community-ui" aria-label="Conversation loading example">
  {#if loading}
    <CommunitySkeleton layout="messages" label="Loading messages" count={3} />
  {:else if outcome === "error"}
    <p role="alert">Messages could not be loaded.</p>
    <Button
      onclick={() => {
        outcome = "content";
      }}>Retry</Button
    >
  {:else if outcome === "empty"}
    <p>No messages yet.</p>
  {:else}
    <div aria-label="Messages">
      {#each Array(count) as _, i}
        <CommunityMessage
          {author}
          message={{
            id: `message-${i}`,
            authorId: author.id,
            content: i ? "Earlier update" : "Research complete",
            timestamp: "Just now",
          }}
        />
      {/each}
      {#if older}<CommunitySkeleton
          layout="messages"
          label="Loading older messages"
          count={1}
        />{/if}
    </div>
    <Button disabled={refreshing} onclick={refresh}>Refresh</Button>
    <Button disabled={older} onclick={loadOlder}>Load older</Button>
    <span class="sr-only" role="status"
      >{refreshing ? "Refreshing messages" : "Up to date"}</span
    >
  {/if}
</div>
