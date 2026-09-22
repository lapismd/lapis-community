<script lang="ts">
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  let {
    layout,
    label = "Loading content",
    count = 4,
    padded = false,
  }: {
    layout: "gallery" | "timeline" | "messages" | "details" | "repository";
    label?: string;
    count?: number;
    padded?: boolean;
  } = $props();
</script>

<div
  class="community-skeleton"
  data-layout={layout}
  data-padded={padded ? "" : undefined}
  role="status"
  aria-label={label}
  aria-busy="true"
>
  <span class="sr-only">{label}</span>
  <div class="community-skeleton__items" aria-hidden="true">
    {#each Array(Math.max(1, Math.min(count, 12))) as _, index (index)}
      <div class="community-skeleton__item">
        {#if layout !== "repository"}<Skeleton
            class="community-skeleton__avatar"
          />{/if}
        <div class="community-skeleton__text">
          <Skeleton class="community-skeleton__title" /><Skeleton
            class="community-skeleton__line"
          />{#if layout !== "gallery"}<Skeleton
              class="community-skeleton__short"
            />{/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .community-skeleton {
    width: 100%;
    min-width: 0;
  }
  .community-skeleton[data-padded] {
    box-sizing: border-box;
    padding: 0.75rem;
  }
  .community-skeleton__items {
    display: grid;
    gap: 1.25rem;
  }
  .community-skeleton__item {
    display: flex;
    gap: 1rem;
    min-width: 0;
  }
  .community-skeleton__text {
    display: grid;
    flex: 1;
    gap: 0.625rem;
    padding-block: 0.25rem;
  }
  :global(.community-skeleton__avatar) {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    flex: none;
  }
  :global(.community-skeleton__title) {
    height: 1rem;
    width: 45%;
  }
  :global(.community-skeleton__line) {
    height: 0.875rem;
    width: 100%;
  }
  :global(.community-skeleton__short) {
    height: 0.875rem;
    width: 70%;
  }
  [data-layout="gallery"] .community-skeleton__items {
    grid-template-columns: repeat(auto-fill, minmax(min(13rem, 100%), 1fr));
  }
  [data-layout="gallery"] .community-skeleton__item {
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    min-height: 17rem;
    justify-content: space-between;
  }
  [data-layout="gallery"] :global(.community-skeleton__avatar) {
    width: 6rem;
    height: 6rem;
    border-radius: 25%;
    margin: 1rem auto;
  }
  [data-layout="gallery"] .community-skeleton__text {
    flex: none;
  }
  [data-layout="timeline"] .community-skeleton__item {
    position: relative;
    padding-bottom: 1rem;
  }
  [data-layout="timeline"] .community-skeleton__item:not(:last-child)::before {
    content: "";
    position: absolute;
    left: 1.125rem;
    top: 2.25rem;
    bottom: -1.25rem;
    border-left: 1px solid var(--border);
  }
  [data-layout="details"] .community-skeleton__item {
    flex-direction: column;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1rem;
  }
  [data-layout="repository"] .community-skeleton__items {
    gap: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  [data-layout="repository"] .community-skeleton__item {
    padding: 0.875rem;
    border-bottom: 1px solid var(--border);
  }
  [data-layout="repository"] .community-skeleton__item:last-child {
    border: 0;
  }
</style>
