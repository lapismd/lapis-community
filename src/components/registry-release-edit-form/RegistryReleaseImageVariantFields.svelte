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
  import RegistryReleaseEditableShaControl from "./RegistryReleaseEditableShaControl.svelte";

  type Props = {
    itemLabel: string;
    activeVariantLabel: string;
    image: RegistryReleaseMediaReferenceDraft;
    readonly?: boolean;
    onDelete: () => void;
    onFieldChange: (key: GalleryImageField, value: string) => void;
  };

  let {
    itemLabel,
    activeVariantLabel,
    image,
    readonly = false,
    onDelete,
    onFieldChange,
  }: Props = $props();
</script>

<div
  class="registry-release-image-set__fields"
  role="tabpanel"
  aria-label={`${itemLabel} ${activeVariantLabel} image fields`}
>
  <div class="registry-release-image-set__variant-actions">
    <span>{activeVariantLabel} image</span>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Delete ${itemLabel} ${activeVariantLabel} image`}
      disabled={readonly}
      onclick={onDelete}
    >
      <TrashIcon aria-hidden="true" />
    </Button>
  </div>
  {#each galleryTextFieldOptions as option (option.key)}
    <label class="registry-release-image-set__field">
      <span>{option.label}</span>
      {#if option.key === "sha256"}
        <RegistryReleaseEditableShaControl
          value={image.sha256}
          label={`${itemLabel} ${activeVariantLabel} ${option.ariaLabel}`}
          {readonly}
          update={(next) => onFieldChange(option.key, next)}
        />
      {:else}
        <Input
          value={image[option.key]}
          disabled={readonly}
          aria-label={`${itemLabel} ${activeVariantLabel} ${option.ariaLabel}`}
          oninput={(event) =>
            onFieldChange(option.key, event.currentTarget.value)}
        />
      {/if}
    </label>
  {/each}
  <div class="registry-release-image-set__numbers">
    {#each galleryNumberFieldOptions as option (option.key)}
      <label class="registry-release-image-set__field">
        <span>{option.label}</span>
        <Input
          value={image[option.key]}
          inputmode="numeric"
          disabled={readonly}
          aria-label={`${itemLabel} ${activeVariantLabel} ${option.ariaLabel}`}
          oninput={(event) =>
            onFieldChange(option.key, event.currentTarget.value)}
        />
      </label>
    {/each}
  </div>
</div>
