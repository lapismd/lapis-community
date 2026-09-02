<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";

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
  <ToggleGroup.Root
    type="single"
    variant="outline"
    bind:value={selected}
    aria-labelledby="rating-label"
    disabled={publishing}
  >
    {#each choices as reaction}
      <ToggleGroup.Item value={reaction} aria-label={`React ${reaction}`}>
        <span aria-hidden="true">{reaction}</span>
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
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

  @media (max-width: 44rem) {
    .rating-control {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
