<script lang="ts">
  import { Input } from "@lapismd/design-core/shadcn/input";
  import ImagePlusIcon from "@lucide/svelte/icons/image-plus";
  import { Button } from "@lapismd/design-core/shadcn/button";

  import {
    galleryVariantFor,
    galleryVariantLabel,
    galleryVariantOptions,
    mapGalleryImages,
    type GalleryImageField,
  } from "./gallery-field-model.js";
  import {
    createBlankMediaReference,
    type RegistryReleaseGalleryVariant,
    type RegistryReleaseImageSetDraft,
  } from "./model.js";
  import RegistryReleaseImageVariantFields from "./RegistryReleaseImageVariantFields.svelte";
  import "./RegistryReleaseImageSetEditor.css";

  type Props = {
    value: RegistryReleaseImageSetDraft;
    itemLabel: string;
    readonly?: boolean;
    update: (next: RegistryReleaseImageSetDraft) => void;
    onEmpty?: () => void;
  };

  let { value, itemLabel, readonly = false, update, onEmpty }: Props = $props();
  let activeVariant = $state<RegistryReleaseGalleryVariant>("full");
  const selectedVariant = $derived(galleryVariantFor(value, activeVariant));
  const activeImage = $derived(value.images[selectedVariant]);
  const activeVariantLabel = $derived(galleryVariantLabel(selectedVariant));

  $effect(() => {
    activeVariant = selectedVariant;
  });

  function commit(next: RegistryReleaseImageSetDraft): void {
    if (!readonly) update(next);
  }

  function updateAlt(alt: string): void {
    commit({
      ...value,
      alt,
      images: mapGalleryImages(value, (image) => ({ ...image, alt })),
    });
  }

  function updateImageField(key: GalleryImageField, nextValue: string): void {
    const image = value.images[selectedVariant];
    if (!image) return;
    commit({
      ...value,
      images: {
        ...value.images,
        [selectedVariant]: { ...image, [key]: nextValue },
      },
    });
  }

  function addVariant(): void {
    commit({
      ...value,
      images: {
        ...value.images,
        [selectedVariant]: createBlankMediaReference(
          value.alt || `${itemLabel} image`,
        ),
      },
    });
  }

  function removeVariant(): void {
    const images = { ...value.images, [selectedVariant]: null };
    if (Object.values(images).every((image) => image === null)) {
      onEmpty?.();
      return;
    }
    commit({ ...value, images });
  }
</script>

<div
  class="registry-release-image-set"
  data-ui-part="registry-release-image-set"
>
  <div class="registry-release-image-set__content">
    <div class="registry-release-image-set__preview">
      {#if activeImage?.url}
        <img src={activeImage.url} alt="" loading="lazy" />
      {:else}
        <ImagePlusIcon aria-hidden="true" />
      {/if}
    </div>

    <div class="registry-release-image-set__editor">
      <label class="registry-release-image-set__field">
        <span>Alt text</span>
        <Input
          value={value.alt}
          disabled={readonly}
          aria-label={`${itemLabel} alt text`}
          oninput={(event) => updateAlt(event.currentTarget.value)}
        />
      </label>

      <div
        class="registry-release-image-set__variant-tabs"
        role="tablist"
        aria-label={`${itemLabel} image types`}
      >
        {#each galleryVariantOptions as option (option.key)}
          <button
            type="button"
            role="tab"
            class:active={selectedVariant === option.key}
            aria-selected={selectedVariant === option.key}
            onclick={() => (activeVariant = option.key)}
          >
            {option.label}
            {#if value.images[option.key] === null}
              <span>Missing</span>
            {/if}
          </button>
        {/each}
      </div>

      {#if activeImage}
        <RegistryReleaseImageVariantFields
          image={activeImage}
          {itemLabel}
          {activeVariantLabel}
          {readonly}
          onDelete={removeVariant}
          onFieldChange={updateImageField}
        />
      {:else}
        <div class="registry-release-image-set__missing">
          <ImagePlusIcon aria-hidden="true" />
          <span>{activeVariantLabel} image missing</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="registry-release-image-set__add"
            disabled={readonly}
            onclick={addVariant}
          >
            Add {activeVariantLabel} image
          </Button>
        </div>
      {/if}
    </div>
  </div>
</div>
