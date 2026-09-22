<script lang="ts">
  import { createBrowserCommunityComposerDraftStore } from "./browser-draft-store.js";
  import { communityComposerDraftKey } from "./composer-draft-keys.js";
  import CommunityPersistedComposer from "./CommunityPersistedComposer.svelte";
  import {
    communityComposerStoryEmojis,
    communityComposerStoryMembers,
    communityComposerStoryRooms,
  } from "./story-fixtures.js";

  const storage: Record<string, string> = {};
  const draftStore = createBrowserCommunityComposerDraftStore(
    {
      getItem: (key) => storage[key] ?? null,
      setItem: (key, value) => {
        storage[key] = value;
      },
      removeItem: (key) => {
        delete storage[key];
      },
    },
    "story-persisted-composer",
  );

  let room = $state<"support" | "general">("support");
  let remount = $state(0);
  const draftKey = $derived(
    communityComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      surface: "forum-topic",
      target: room,
    }),
  );
</script>

<div class="community-persisted-composer-story-host">
  <div class="community-persisted-composer-story-host__actions">
    <button type="button" onclick={() => (remount += 1)}>Remount</button>
    <button
      type="button"
      onclick={() => (room = room === "support" ? "general" : "support")}
    >
      Switch room
    </button>
  </div>
  {#key remount}
    <CommunityPersistedComposer
      class="community-chat-composer-story"
      {draftKey}
      {draftStore}
      members={communityComposerStoryMembers}
      rooms={communityComposerStoryRooms}
      communityEmojis={communityComposerStoryEmojis}
      currentMemberId="ada"
      placeholder="Message the community"
      ariaLabel="Message composer"
    />
  {/key}
</div>
