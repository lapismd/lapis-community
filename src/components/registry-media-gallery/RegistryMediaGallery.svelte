<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import type { RegistryGalleryItem } from "../../registry/index.js";

  let {
    items,
    pluginName,
  }: {
    items: readonly RegistryGalleryItem[];
    pluginName: string;
  } = $props();

  let open = $state(false);
  let selectedIndex = $state(0);
  const selected = $derived(items[selectedIndex]);

  function show(index: number): void {
    selectedIndex = index;
    open = true;
  }

  function move(offset: -1 | 1): void {
    if (items.length === 0) return;
    selectedIndex = (selectedIndex + offset + items.length) % items.length;
  }
</script>

{#if items.length > 0}
  <section
    class="registry-media-gallery"
    aria-labelledby="registry-media-gallery-title"
  >
    <div class="registry-media-gallery__heading">
      <h2 id="registry-media-gallery-title">{pluginName} screenshots</h2>
      <span>{items.length} images</span>
    </div>
    <div
      class="registry-media-gallery__track"
      aria-label={`${pluginName} screenshot carousel`}
    >
      {#each items as item, index (item.id)}
        <button
          type="button"
          aria-label={`Open screenshot ${index + 1} of ${items.length}: ${item.alt}`}
          onclick={() => show(index)}
        >
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcset={item.images.dark.url}
            />
            <img
              src={item.images.preview.url}
              width={item.images.preview.width}
              height={item.images.preview.height}
              alt={item.alt}
              loading="lazy"
            />
          </picture>
        </button>
      {/each}
    </div>
  </section>

  <Dialog.Root bind:open>
    <Dialog.Content class="registry-media-gallery__dialog">
      <Dialog.Header>
        <Dialog.Title>{pluginName} screenshot {selectedIndex + 1}</Dialog.Title>
        <Dialog.Description>{selected?.alt}</Dialog.Description>
      </Dialog.Header>
      {#if selected}
        <div class="registry-media-gallery__viewer">
          <img src={selected.images.full.url} alt={selected.alt} />
          {#if items.length > 1}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Previous screenshot"
              onclick={() => move(-1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Next screenshot"
              onclick={() => move(1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          {/if}
        </div>
      {/if}
    </Dialog.Content>
  </Dialog.Root>
{/if}

<style>
  .registry-media-gallery {
    display: grid;
    gap: 0.9rem;
  }

  .registry-media-gallery__heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .registry-media-gallery__heading span {
    color: var(--muted-foreground);
    font-size: 0.8rem;
  }

  .registry-media-gallery__track {
    display: grid;
    grid-auto-columns: minmax(18rem, 38rem);
    grid-auto-flow: column;
    gap: 0.75rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }

  .registry-media-gallery__track button {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.4);
    padding: 0;
    background: var(--muted);
    cursor: zoom-in;
    scroll-snap-align: start;
  }

  .registry-media-gallery__track img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  :global(.registry-media-gallery__dialog) {
    width: min(72rem, calc(100vw - 2rem));
    max-width: 72rem;
  }

  .registry-media-gallery__viewer {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius);
    background: var(--muted);
  }

  .registry-media-gallery__viewer img {
    display: block;
    max-width: 100%;
    max-height: 70vh;
    margin: auto;
  }

  .registry-media-gallery__viewer :global(button) {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }

  .registry-media-gallery__viewer :global(button:first-of-type) {
    left: 0.75rem;
  }

  .registry-media-gallery__viewer :global(button:last-of-type) {
    right: 0.75rem;
  }
</style>
