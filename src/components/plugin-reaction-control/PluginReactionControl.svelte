<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";

  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import type { ReactionGroup } from "../registry-community/model.js";

  let {
    summary = [],
    selected = $bindable(""),
    publishing = false,
    releaseAvailable = false,
    hasOwnReaction = false,
    onSubmit,
  }: {
    summary?: ReactionGroup[];
    selected?: string;
    publishing?: boolean;
    releaseAvailable?: boolean;
    hasOwnReaction?: boolean;
    onSubmit: () => void | Promise<void>;
  } = $props();

  const choices = ["👍", "❤️", "🎉", "👀", "⭐"] as const;
</script>

<div class="rating-control">
  <div>
    <span class="field-label" id="rating-label">React to this plugin</span>
    <p>
      {#if summary.length === 0}
        Be the first to react to the latest release.
      {:else}
        {summary.map((group) => `${group.symbol} ${group.count}`).join(" · ")}
      {/if}
    </p>
  </div>
  <div class="rating-control__picker" aria-labelledby="rating-label">
    {#if selected}
      <span class="rating-control__selected" aria-label={`Selected ${selected}`}
        >{selected}</span
      >
    {/if}
    <CommunityEmojiPicker
      label="Choose plugin reaction"
      disabled={publishing}
      presets={choices}
      onSelect={(emoji) => (selected = emoji)}
    />
  </div>
  <Button
    size="sm"
    disabled={publishing || selected === "" || !releaseAvailable}
    onclick={onSubmit}
  >
    {hasOwnReaction ? "Update reaction" : "Publish reaction"}
  </Button>
</div>

<style>
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

  .field-label {
    font-size: 0.95rem;
    font-weight: 650;
  }

  p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  .rating-control__picker {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .rating-control__selected {
    display: grid;
    min-width: 2rem;
    min-height: 2rem;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--background);
  }

  @media (max-width: 44rem) {
    .rating-control {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
