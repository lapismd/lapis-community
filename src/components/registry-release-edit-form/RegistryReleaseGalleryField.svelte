<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import ImagePlusIcon from "@lucide/svelte/icons/image-plus";
  import TrashIcon from "@lucide/svelte/icons/trash-2";

  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import { nextGalleryItemCount } from "./gallery-field-model.js";
  import RegistryReleaseImageSetEditor from "./RegistryReleaseImageSetEditor.svelte";
  import type { RegistryReleaseEditDraft } from "./model.js";
  import {
    createBlankGalleryItem,
    type RegistryReleaseGalleryItemDraft,
    type RegistryReleaseImageSetDraft,
  } from "./model.js";
  import "./RegistryReleaseGalleryField.css";

  type Props = RegisteredFormRendererProps<
    "registry-gallery",
    RegistryReleaseEditDraft
  > & {
    sectioned?: boolean;
  };

  let {
    value = [],
    field,
    readonly = false,
    update,
    sectioned = false,
  }: Props = $props();
  let activeIndex = $state(0);
  const items = $derived(Array.isArray(value) ? value : []);
  const addLabel = $derived(field.addLabel ?? "Add screenshot");
  const activeItem = $derived(items[activeIndex] ?? null);

  $effect(() => {
    if (items.length === 0) activeIndex = 0;
    else if (activeIndex >= items.length) activeIndex = items.length - 1;
  });

  function commit(next: RegistryReleaseGalleryItemDraft[]): void {
    if (!readonly) void update(next);
  }

  function updateItem(
    index: number,
    nextItem: RegistryReleaseImageSetDraft,
  ): void {
    const item = items[index];
    const next = [...items];
    if (!item) return;
    next[index] = {
      ...item,
      ...nextItem,
    };
    commit(next);
  }

  function addItem(): void {
    const item = createBlankGalleryItem(nextGalleryItemCount(items));
    commit([...items, item]);
    activeIndex = items.length;
  }

  function cycleItem(direction: -1 | 1): void {
    if (items.length > 1)
      activeIndex = (activeIndex + direction + items.length) % items.length;
  }

  function removeItem(index: number): void {
    const item = items[index];
    if (!item) return;
    commit(items.filter((_, itemIndex) => itemIndex !== index));
    activeIndex = Math.max(0, Math.min(index, items.length - 2));
  }
</script>

<section
  class="registry-release-gallery"
  data-ui-part="registry-release-gallery"
  aria-label={field.label}
>
  <div class="registry-release-gallery__header">
    <div>
      {#if !sectioned}
        <p>{field.label}</p>
      {/if}
      <span>{items.length} screenshot{items.length === 1 ? "" : "s"}</span>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="registry-release-gallery__add"
      disabled={readonly}
      onclick={addItem}
    >
      <ImagePlusIcon data-icon="inline-start" aria-hidden="true" />
      {addLabel}
    </Button>
  </div>

  {#if activeItem}
    <article
      class="registry-release-gallery__card"
      data-ui-part="registry-release-gallery-card"
    >
      <div class="registry-release-gallery__card-header">
        <div class="registry-release-gallery__pager">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous screenshot"
            disabled={items.length <= 1}
            onclick={() => cycleItem(-1)}
          >
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
          <span>{activeIndex + 1} of {items.length}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next screenshot"
            disabled={items.length <= 1}
            onclick={() => cycleItem(1)}
          >
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete screenshot ${activeIndex + 1}`}
          disabled={readonly}
          onclick={() => removeItem(activeIndex)}
        >
          <TrashIcon aria-hidden="true" />
        </Button>
      </div>

      <RegistryReleaseImageSetEditor
        value={activeItem}
        itemLabel={`Screenshot ${activeIndex + 1}`}
        {readonly}
        update={(next) => updateItem(activeIndex, next)}
      />
    </article>
  {:else}
    <div class="registry-release-gallery__empty">
      <ImagePlusIcon aria-hidden="true" />
      <span>No screenshots yet</span>
    </div>
  {/if}
</section>
