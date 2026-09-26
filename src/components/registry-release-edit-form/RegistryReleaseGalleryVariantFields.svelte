<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import TrashIcon from "@lucide/svelte/icons/trash-2";

  import {
    galleryNumberFieldOptions,
    galleryTextFieldOptions,
    type GalleryImageField,
  } from "./gallery-field-model.js";
  import type { RegistryReleaseMediaReferenceDraft } from "./model.js";

  type Props = {
    activeIndex: number;
    activeVariantLabel: string;
    image: RegistryReleaseMediaReferenceDraft;
    readonly?: boolean;
    onDelete: () => void;
    onFieldChange: (key: GalleryImageField, value: string) => void;
  };

  let {
    activeIndex,
    activeVariantLabel,
    image,
    readonly = false,
    onDelete,
    onFieldChange,
  }: Props = $props();
</script>

<div
  class="registry-release-gallery__fields"
  role="tabpanel"
  aria-label={`${activeVariantLabel} screenshot fields`}
>
  <div class="registry-release-gallery__variant-actions">
    <span>{activeVariantLabel} image</span>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Delete ${activeVariantLabel} image`}
      disabled={readonly}
      onclick={onDelete}
    >
      <TrashIcon aria-hidden="true" />
    </Button>
  </div>
  {#each galleryTextFieldOptions as option (option.key)}
    <label class="registry-release-gallery__field">
      <span>{option.label}</span>
      <Input
        value={image[option.key]}
        disabled={readonly}
        aria-label={`Screenshot ${activeIndex + 1} ${activeVariantLabel} ${option.ariaLabel}`}
        oninput={(event) =>
          onFieldChange(option.key, event.currentTarget.value)}
      />
    </label>
  {/each}
  <div class="registry-release-gallery__numbers">
    {#each galleryNumberFieldOptions as option (option.key)}
      <label class="registry-release-gallery__field">
        <span>{option.label}</span>
        <Input
          value={image[option.key]}
          inputmode="numeric"
          disabled={readonly}
          aria-label={`Screenshot ${activeIndex + 1} ${activeVariantLabel} ${option.ariaLabel}`}
          oninput={(event) =>
            onFieldChange(option.key, event.currentTarget.value)}
        />
      </label>
    {/each}
  </div>
</div>
