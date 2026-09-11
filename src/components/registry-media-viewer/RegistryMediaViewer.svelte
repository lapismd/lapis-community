<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { tick } from "svelte";

  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";

  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

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
    <DialogFrame
      bind:ref={dialog}
      data-media-mode={mode}
      onkeydown={handleKeydown}
      closeLabel="Close media viewer"
      size="wide"
      bodyPadding="none"
    >
      {#snippet title()}
        {pluginName} media viewer
      {/snippet}

      {#snippet headerActions()}
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
      {/snippet}

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

      {#snippet footer()}
        {#if items.length > 1}
          <Button
            class="registry-media-viewer__previous"
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Previous image"
            disabled={selectedIndex === 0}
            onclick={() => moveTo(selectedIndex - 1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            class="registry-media-viewer__next"
            type="button"
            variant="outline"
            size="icon-sm"
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
      {/snippet}
    </DialogFrame>
  {/if}
</Dialog.Root>

<style>
  .registry-media-viewer__track {
    display: flex;
    width: 100%;
    height: min(60dvh, 40rem);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-behavior: smooth;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
  }
  .registry-media-viewer__slide {
    display: grid;
    flex: 0 0 100%;
    min-width: 0;
    height: 100%;
    padding: 1rem;
    place-items: center;
    box-sizing: border-box;
    scroll-snap-align: start;
  }
  .registry-media-viewer__slide :global(img) {
    display: block;
    max-width: 100%;
    max-height: min(55dvh, 36rem);
    object-fit: contain;
  }
  .registry-media-viewer__status {
    margin: auto 0 auto auto;
    font-size: var(--community-text-secondary);
    color: var(--muted-foreground);
  }
  @media (prefers-reduced-motion: reduce) {
    .registry-media-viewer__track {
      scroll-behavior: auto;
    }
  }
</style>
