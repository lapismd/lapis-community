<script lang="ts">
  import { onMount, tick } from "svelte";

  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import XIcon from "@lucide/svelte/icons/x";

  import type { RegistryMediaItem } from "../../registry/index.js";
  import RegistryVerifiedImage from "../registry-verified-image/RegistryVerifiedImage.svelte";

  type MediaMode = "full" | "light" | "dark";

  let {
    items,
    pluginName,
    open = $bindable(false),
    selectedIndex = $bindable(0),
    opener = null,
  }: {
    items: readonly RegistryMediaItem[];
    pluginName: string;
    open?: boolean;
    selectedIndex?: number;
    opener?: HTMLElement | null;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  let track = $state<HTMLDivElement>();
  let closeButton = $state<HTMLButtonElement>();
  let mode = $state<MediaMode>("full");
  let locked = false;
  let previousBodyOverflow = "";
  let previousRootOverflow = "";
  const lastIndex = $derived(Math.max(0, items.length - 1));

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      selectedIndex = Math.min(Math.max(selectedIndex, 0), lastIndex);
      mode = "full";
      lockDocumentScroll();
      dialog.showModal();
      void tick().then(() => {
        scrollToSelected("auto");
        closeButton?.focus();
      });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  onMount(() => {
    const handleDocumentKeydown = (event: KeyboardEvent) => {
      if (
        open &&
        dialog !== undefined &&
        !dialog.contains(event.target as Node)
      ) {
        handleKeydown(event);
      }
    };
    document.addEventListener("keydown", handleDocumentKeydown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeydown);
      unlockDocumentScroll();
    };
  });

  function imageFor(item: RegistryMediaItem) {
    return item.images[mode];
  }

  function setMode(nextMode: MediaMode): void {
    mode = nextMode;
  }

  function closeViewer(): void {
    open = false;
    if (dialog?.open) dialog.close();
    finishClose();
  }

  function afterClose(): void {
    open = false;
    finishClose();
  }

  function finishClose(): void {
    unlockDocumentScroll();
    const returnTarget = opener;
    requestAnimationFrame(() => returnTarget?.focus());
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
      const modes: MediaMode[] = ["full", "light", "dark"];
      const offset = event.key === "ArrowLeft" ? -1 : 1;
      const next = (modes.indexOf(mode) + offset + modes.length) % modes.length;
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
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeViewer();
    }
  }

  function lockDocumentScroll(): void {
    if (locked || typeof document === "undefined") return;
    previousBodyOverflow = document.body.style.overflow;
    previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    locked = true;
  }

  function unlockDocumentScroll(): void {
    if (!locked || typeof document === "undefined") return;
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousRootOverflow;
    locked = false;
  }
</script>

<dialog
  bind:this={dialog}
  class="registry-media-viewer"
  aria-labelledby="registry-media-viewer-title"
  data-media-mode={mode}
  onclose={afterClose}
  oncancel={(event) => {
    event.preventDefault();
    closeViewer();
  }}
  onkeydown={handleKeydown}
  onclick={(event) => {
    if (event.target === dialog) closeViewer();
  }}
>
  <h2 id="registry-media-viewer-title" class="registry-media-viewer__sr-only">
    {pluginName} media viewer
  </h2>
  <div
    class="registry-media-viewer__modes"
    role="group"
    aria-label="Image theme"
  >
    {#each [["full", "Split"], ["light", "Light"], ["dark", "Dark"]] as [value, label]}
      <button
        type="button"
        data-media-mode={value}
        aria-pressed={mode === value}
        onclick={() => setMode(value as MediaMode)}>{label}</button
      >
    {/each}
  </div>
  <button
    bind:this={closeButton}
    class="registry-media-viewer__close"
    type="button"
    aria-label="Close media viewer"
    onclick={closeViewer}
  >
    <XIcon aria-hidden="true" />
  </button>

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
    <button
      class="registry-media-viewer__previous"
      type="button"
      aria-label="Previous image"
      disabled={selectedIndex === 0}
      onclick={() => moveTo(selectedIndex - 1)}
    >
      <ChevronLeftIcon aria-hidden="true" />
    </button>
    <button
      class="registry-media-viewer__next"
      type="button"
      aria-label="Next image"
      disabled={selectedIndex === lastIndex}
      onclick={() => moveTo(selectedIndex + 1)}
    >
      <ChevronRightIcon aria-hidden="true" />
    </button>
  {/if}

  <p class="registry-media-viewer__status" aria-live="polite">
    {selectedIndex + 1} of {items.length}: {items[selectedIndex]?.alt}
  </p>
</dialog>

<style>
  .registry-media-viewer {
    position: fixed;
    inset: 0;
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
    overflow: hidden;
  }
  .registry-media-viewer::backdrop {
    background: #000;
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
  .registry-media-viewer__modes {
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
  .registry-media-viewer__modes button {
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
  .registry-media-viewer__modes button[aria-pressed="true"] {
    color: white;
    background: rgb(255 255 255 / 14%);
  }
  .registry-media-viewer__modes button:focus-visible,
  .registry-media-viewer > button:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }
  .registry-media-viewer > button {
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
  .registry-media-viewer > button :global(svg) {
    width: 1.15rem;
    height: 1.15rem;
  }
  .registry-media-viewer > button:disabled {
    opacity: 0.25;
    cursor: default;
  }
  .registry-media-viewer__close {
    top: 1rem;
    right: 1rem;
  }
  .registry-media-viewer__previous,
  .registry-media-viewer__next {
    top: 50%;
    transform: translateY(-50%);
  }
  .registry-media-viewer__previous {
    left: 1rem;
  }
  .registry-media-viewer__next {
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
  .registry-media-viewer__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  @media (max-width: 45rem) {
    .registry-media-viewer__previous,
    .registry-media-viewer__next {
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
