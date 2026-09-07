<script lang="ts">
  import { tick } from "svelte";

  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";

  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import XIcon from "@lucide/svelte/icons/x";

  import type { RegistryMediaItem } from "../../registry/index.js";
  import RegistryVerifiedImage from "../registry-verified-image/RegistryVerifiedImage.svelte";

  type MediaMode = "preview" | "full" | "light" | "dark";
  type SelectableMediaMode = Exclude<MediaMode, "preview">;

  let {
    items,
    pluginName,
    open = $bindable(false),
    selectedIndex = $bindable(0),
    initialMode = "full",
    opener = null,
  }: {
    items: readonly RegistryMediaItem[];
    pluginName: string;
    open?: boolean;
    selectedIndex?: number;
    initialMode?: MediaMode;
    opener?: HTMLElement | null;
  } = $props();

  let dialog = $state<HTMLElement | null>(null);
  let track = $state<HTMLDivElement>();
  let mode = $state<MediaMode>("full");
  let wasOpen = false;
  const lastIndex = $derived(Math.max(0, items.length - 1));
  const mediaModes = [
    ["full", "Split"],
    ["light", "Light"],
    ["dark", "Dark"],
  ] as const;

  $effect(() => {
    if (open && !wasOpen) {
      selectedIndex = Math.min(Math.max(selectedIndex, 0), lastIndex);
      mode = initialMode;
      void tick().then(() => {
        scrollToSelected("auto");
      });
    } else if (!open && wasOpen) {
      const returnTarget = opener;
      requestAnimationFrame(() => returnTarget?.focus());
    }
    wasOpen = open;
  });

  function imageFor(item: RegistryMediaItem) {
    return item.images[mode];
  }

  function setMode(nextMode: MediaMode): void {
    mode = nextMode;
  }

  function moveTo(index: number): void {
    selectedIndex = Math.min(Math.max(index, 0), lastIndex);
    scrollToSelected("smooth");
  }

  function scrollToSelected(behavior: ScrollBehavior): void {
    track?.scrollTo({
      left: selectedIndex * (track?.clientWidth ?? 0),
      behavior,
    });
  }

  function updateSelectedFromScroll(): void {
    if (!track?.clientWidth) return;
    selectedIndex = Math.min(
      Math.max(Math.round(track.scrollLeft / track.clientWidth), 0),
      lastIndex,
    );
  }

  function handleKeydown(event: KeyboardEvent): void {
    const modeButton = (event.target as HTMLElement).closest(
      "[data-media-mode]",
    );
    if (
      modeButton &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      event.preventDefault();
      const modes: SelectableMediaMode[] = ["full", "light", "dark"];
      const offset = event.key === "ArrowLeft" ? -1 : 1;
      const focusedMode = modeButton.getAttribute(
        "data-media-mode",
      ) as SelectableMediaMode;
      const next =
        (modes.indexOf(focusedMode) + offset + modes.length) % modes.length;
      setMode(modes[next]!);
      const buttons =
        dialog?.querySelectorAll<HTMLButtonElement>("[data-media-mode]");
      buttons?.[next]?.focus();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTo(selectedIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTo(selectedIndex + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveTo(lastIndex);
    }
  }
</script>

<Dialog.Root bind:open>
  {#if open}
    <Dialog.Content
      bind:ref={dialog}
      class="registry-media-viewer"
      showCloseButton={false}
      data-media-mode={mode}
      onkeydown={handleKeydown}
    >
      <Dialog.Title class="sr-only">
        {pluginName} media viewer
      </Dialog.Title>
      <ToggleGroup.Root
        type="single"
        value={mode}
        onValueChange={(value) => value && setMode(value as MediaMode)}
        size="sm"
        spacing={1}
        variant="outline"
        class="registry-media-viewer__modes"
        aria-label="Image theme"
      >
        {#each mediaModes as [value, label]}
          <ToggleGroup.Item {value} data-media-mode={value}
            >{label}</ToggleGroup.Item
          >
        {/each}
      </ToggleGroup.Root>
      <Dialog.Close>
        {#snippet child({ props })}
          <Button
            {...props}
            class="registry-media-viewer__close"
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close media viewer"
          >
            <XIcon aria-hidden="true" />
          </Button>
        {/snippet}
      </Dialog.Close>

      <div
        bind:this={track}
        class="registry-media-viewer__track"
        role="listbox"
        aria-label={`${pluginName} media`}
        tabindex="0"
        onscroll={updateSelectedFromScroll}
        onkeydown={(event) => {
          event.stopPropagation();
          handleKeydown(event);
        }}
      >
        {#each items as item, index}
          {@const image = imageFor(item)}
          <div
            class="registry-media-viewer__slide"
            role="option"
            aria-selected={index === selectedIndex}
          >
            <RegistryVerifiedImage
              reference={image}
              alt={item.alt}
              width={image.width}
              height={image.height}
              loading={index === selectedIndex ? "eager" : "lazy"}
            />
          </div>
        {/each}
      </div>

      {#if items.length > 1}
        <Button
          class="registry-media-viewer__previous"
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous image"
          disabled={selectedIndex === 0}
          onclick={() => moveTo(selectedIndex - 1)}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          class="registry-media-viewer__next"
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next image"
          disabled={selectedIndex === lastIndex}
          onclick={() => moveTo(selectedIndex + 1)}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      {/if}

      <p class="registry-media-viewer__status" aria-live="polite">
        {selectedIndex + 1} of {items.length}: {items[selectedIndex]?.alt}
      </p>
    </Dialog.Content>
  {/if}
</Dialog.Root>

<style>
  :global(.registry-media-viewer) {
    position: fixed;
    inset: 0;
    top: 0;
    left: 0;
    box-sizing: border-box;
    width: 100vw;
    max-width: none;
    height: 100dvh;
    max-height: none;
    margin: 0;
    border: 0;
    padding: 0;
    color: white;
    background: #000;
    box-shadow: none;
    overflow: hidden;
    translate: none;
  }
  .registry-media-viewer__track {
    display: flex;
    width: 100%;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    scroll-behavior: smooth;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
  }
  .registry-media-viewer__track::-webkit-scrollbar {
    display: none;
  }
  .registry-media-viewer__slide {
    display: grid;
    min-width: 100%;
    height: 100%;
    margin: 0;
    padding: clamp(4.5rem, 8vw, 6rem) clamp(1rem, 6vw, 5rem) 3rem;
    place-items: center;
    box-sizing: border-box;
    scroll-snap-align: start;
  }
  .registry-media-viewer__slide :global(img) {
    display: block;
    max-width: min(93vw, 75rem);
    max-height: 86dvh;
    object-fit: contain;
  }
  :global(.registry-media-viewer__modes) {
    position: fixed;
    z-index: 2;
    top: 1rem;
    left: 50%;
    display: flex;
    gap: 0.2rem;
    transform: translateX(-50%);
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 999px;
    padding: 0.2rem;
    background: rgb(24 24 27 / 88%);
    backdrop-filter: blur(12px);
  }
  :global(.registry-media-viewer__modes [data-ui-part="toggle-group-item"]) {
    min-height: 2rem;
    border: 0;
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    color: rgb(255 255 255 / 68%);
    background: transparent;
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
  }
  :global(
      .registry-media-viewer__modes
        [data-ui-part="toggle-group-item"][data-state="on"]
    ) {
    color: white;
    background: rgb(255 255 255 / 14%);
  }
  :global(
      .registry-media-viewer__modes
        [data-ui-part="toggle-group-item"]:focus-visible
    ),
  :global(.registry-media-viewer__close:focus-visible),
  :global(.registry-media-viewer__previous:focus-visible),
  :global(.registry-media-viewer__next:focus-visible) {
    outline: 2px solid white;
    outline-offset: 2px;
  }
  :global(.registry-media-viewer__close),
  :global(.registry-media-viewer__previous),
  :global(.registry-media-viewer__next) {
    position: fixed;
    z-index: 2;
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    place-items: center;
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 999px;
    padding: 0;
    color: white;
    background: rgb(24 24 27 / 78%);
    cursor: pointer;
    backdrop-filter: blur(12px);
  }
  :global(.registry-media-viewer__close svg),
  :global(.registry-media-viewer__previous svg),
  :global(.registry-media-viewer__next svg) {
    width: 1.15rem;
    height: 1.15rem;
  }
  :global(.registry-media-viewer__previous:disabled),
  :global(.registry-media-viewer__next:disabled) {
    opacity: 0.25;
    cursor: default;
  }
  :global(.registry-media-viewer__close) {
    top: 1rem;
    right: 1rem;
  }
  :global(.registry-media-viewer__previous),
  :global(.registry-media-viewer__next) {
    top: 50%;
    transform: translateY(-50%);
  }
  :global(.registry-media-viewer__previous) {
    left: 1rem;
  }
  :global(.registry-media-viewer__next) {
    right: 1rem;
  }
  .registry-media-viewer__status {
    position: fixed;
    z-index: 2;
    bottom: 0.75rem;
    left: 50%;
    max-width: calc(100vw - 2rem);
    transform: translateX(-50%);
    color: rgb(255 255 255 / 68%);
    font-size: 0.78rem;
    text-align: center;
  }
  @media (max-width: 45rem) {
    :global(.registry-media-viewer__previous),
    :global(.registry-media-viewer__next) {
      display: none !important;
    }
    .registry-media-viewer__slide {
      padding-inline: 0.5rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .registry-media-viewer__track {
      scroll-behavior: auto;
    }
  }
</style>
