<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import ImagePlusIcon from "@lucide/svelte/icons/image-plus";
  import TrashIcon from "@lucide/svelte/icons/trash-2";

  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import {
    galleryVariantFor,
    galleryVariantLabel,
    galleryVariantOptions,
    mapGalleryImages,
    nextGalleryItemCount,
    type GalleryImageField,
  } from "./gallery-field-model.js";
  import RegistryReleaseGalleryVariantFields from "./RegistryReleaseGalleryVariantFields.svelte";
  import type { RegistryReleaseEditDraft } from "./model.js";
  import {
    createBlankGalleryItem,
    createBlankMediaReference,
    type RegistryReleaseGalleryItemDraft,
    type RegistryReleaseGalleryVariant,
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
  let activeVariants = $state<Record<string, RegistryReleaseGalleryVariant>>(
    {},
  );
  const items = $derived(Array.isArray(value) ? value : []);
  const addLabel = $derived(field.addLabel ?? "Add screenshot");
  const activeItem = $derived(items[activeIndex] ?? null);
  const activeVariant = $derived(
    activeItem === null
      ? "full"
      : galleryVariantFor(activeItem, activeVariants[activeItem.id]),
  );
  const activeImage = $derived(activeItem?.images[activeVariant] ?? null);
  const activeVariantLabel = $derived(galleryVariantLabel(activeVariant));

  $effect(() => {
    if (items.length === 0) activeIndex = 0;
    else if (activeIndex >= items.length) activeIndex = items.length - 1;
  });

  function commit(next: RegistryReleaseGalleryItemDraft[]): void {
    if (!readonly) void update(next);
  }

  function selectVariant(variant: RegistryReleaseGalleryVariant): void {
    if (!activeItem) return;
    activeVariants = { ...activeVariants, [activeItem.id]: variant };
  }

  function updateItem(
    index: number,
    nextItem: RegistryReleaseGalleryItemDraft,
  ): void {
    const next = [...items];
    if (!next[index]) return;
    next[index] = nextItem;
    commit(next);
  }

  function updateAlt(index: number, alt: string): void {
    const item = items[index];
    if (!item) return;
    updateItem(index, {
      ...item,
      alt,
      images: mapGalleryImages(item, (image) => ({ ...image, alt })),
    });
  }

  function updateImageField(
    index: number,
    variant: RegistryReleaseGalleryVariant,
    key: GalleryImageField,
    nextValue: string,
  ): void {
    const item = items[index];
    const image = item?.images[variant];
    if (!item || !image) return;
    updateItem(index, {
      ...item,
      images: { ...item.images, [variant]: { ...image, [key]: nextValue } },
    });
  }

  function addItem(): void {
    const item = createBlankGalleryItem(nextGalleryItemCount(items));
    commit([...items, item]);
    activeIndex = items.length;
    activeVariants = { ...activeVariants, [item.id]: "full" };
  }

  function cycleItem(direction: -1 | 1): void {
    if (items.length > 1)
      activeIndex = (activeIndex + direction + items.length) % items.length;
  }

  function removeItem(index: number): void {
    const item = items[index];
    if (!item) return;
    commit(items.filter((_, itemIndex) => itemIndex !== index));
    const { [item.id]: _removed, ...remainingVariants } = activeVariants;
    activeVariants = remainingVariants;
    activeIndex = Math.max(0, Math.min(index, items.length - 2));
  }

  function addVariant(
    index: number,
    variant: RegistryReleaseGalleryVariant,
  ): void {
    const item = items[index];
    if (!item) return;
    updateItem(index, {
      ...item,
      images: {
        ...item.images,
        [variant]: createBlankMediaReference(
          item.alt || `Screenshot ${index + 1}`,
        ),
      },
    });
    selectVariant(variant);
  }

  function removeVariant(
    index: number,
    variant: RegistryReleaseGalleryVariant,
  ): void {
    const item = items[index];
    if (!item) return;
    updateItem(index, {
      ...item,
      images: { ...item.images, [variant]: null },
    });
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

      <div class="registry-release-gallery__content">
        <div class="registry-release-gallery__preview">
          {#if activeImage?.url}
            <img src={activeImage.url} alt="" loading="lazy" />
          {:else}
            <ImagePlusIcon aria-hidden="true" />
          {/if}
        </div>

        <div class="registry-release-gallery__editor">
          <label class="registry-release-gallery__field">
            <span>Alt text</span>
            <Input
              value={activeItem.alt}
              disabled={readonly}
              aria-label={`Screenshot ${activeIndex + 1} alt text`}
              oninput={(event) =>
                updateAlt(activeIndex, event.currentTarget.value)}
            />
          </label>

          <div
            class="registry-release-gallery__variant-tabs"
            role="tablist"
            aria-label={`Screenshot ${activeIndex + 1} image types`}
          >
            {#each galleryVariantOptions as option (option.key)}
              <button
                type="button"
                role="tab"
                class:active={activeVariant === option.key}
                aria-selected={activeVariant === option.key}
                onclick={() => selectVariant(option.key)}
              >
                {option.label}
                {#if activeItem.images[option.key] === null}
                  <span>Missing</span>
                {/if}
              </button>
            {/each}
          </div>

          {#if activeImage}
            <RegistryReleaseGalleryVariantFields
              image={activeImage}
              {activeIndex}
              {activeVariantLabel}
              {readonly}
              onDelete={() => removeVariant(activeIndex, activeVariant)}
              onFieldChange={(key, nextValue) =>
                updateImageField(activeIndex, activeVariant, key, nextValue)}
            />
          {:else}
            <div class="registry-release-gallery__missing">
              <ImagePlusIcon aria-hidden="true" />
              <span>{activeVariantLabel} image missing</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="registry-release-gallery__add"
                disabled={readonly}
                onclick={() => addVariant(activeIndex, activeVariant)}
              >
                Add {activeVariantLabel} image
              </Button>
            </div>
          {/if}
        </div>
      </div>
    </article>
  {:else}
    <div class="registry-release-gallery__empty">
      <ImagePlusIcon aria-hidden="true" />
      <span>No screenshots yet</span>
    </div>
  {/if}
</section>
