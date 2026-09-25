<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import ImagePlusIcon from "@lucide/svelte/icons/image-plus";
  import TrashIcon from "@lucide/svelte/icons/trash-2";

  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import {
    createBlankMediaReference,
    type RegistryReleaseMediaReferenceDraft,
  } from "./model.js";

  type Props = RegisteredFormRendererProps<
    "registry-media-reference",
    RegistryReleaseEditDraft
  >;

  let { value, field, readonly = false, update }: Props = $props();

  const addLabel = $derived(field.addLabel ?? `Add ${field.label}`);

  function commit(
    key: keyof RegistryReleaseMediaReferenceDraft,
    nextValue: string,
  ): void {
    if (readonly || !value) return;
    void update({ ...value, [key]: nextValue });
  }

  function addReference(): void {
    if (readonly) return;
    void update(createBlankMediaReference(field.label));
  }

  function removeReference(): void {
    if (readonly) return;
    void update(null);
  }
</script>

<div
  class="registry-release-media-reference"
  data-ui-part="registry-release-media-reference"
>
  {#if value}
    <div class="registry-release-media-reference__preview">
      {#if value.url}
        <img src={value.url} alt="" loading="lazy" />
      {:else}
        <ImagePlusIcon aria-hidden="true" />
      {/if}
    </div>
    <div class="registry-release-media-reference__fields">
      <label>
        <span>Alt text</span>
        <Input
          value={value.alt}
          disabled={readonly}
          aria-label={`${field.label} alt text`}
          oninput={(event) => commit("alt", event.currentTarget.value)}
        />
      </label>
      <label class="registry-release-media-reference__wide">
        <span>Image URL</span>
        <Input
          value={value.url}
          disabled={readonly}
          aria-label={`${field.label} image URL`}
          oninput={(event) => commit("url", event.currentTarget.value)}
        />
      </label>
      <label class="registry-release-media-reference__wide">
        <span>Source URL</span>
        <Input
          value={value.sourceUrl}
          disabled={readonly}
          aria-label={`${field.label} source URL`}
          oninput={(event) => commit("sourceUrl", event.currentTarget.value)}
        />
      </label>
      <label class="registry-release-media-reference__wide">
        <span>SHA-256</span>
        <Input
          value={value.sha256}
          disabled={readonly}
          aria-label={`${field.label} SHA-256`}
          oninput={(event) => commit("sha256", event.currentTarget.value)}
        />
      </label>
      <label>
        <span>Media type</span>
        <Input
          value={value.mediaType}
          disabled={readonly}
          aria-label={`${field.label} media type`}
          oninput={(event) => commit("mediaType", event.currentTarget.value)}
        />
      </label>
      <label>
        <span>Size bytes</span>
        <Input
          value={value.size}
          inputmode="numeric"
          disabled={readonly}
          aria-label={`${field.label} size bytes`}
          oninput={(event) => commit("size", event.currentTarget.value)}
        />
      </label>
      <label>
        <span>Width</span>
        <Input
          value={value.width}
          inputmode="numeric"
          disabled={readonly}
          aria-label={`${field.label} width`}
          oninput={(event) => commit("width", event.currentTarget.value)}
        />
      </label>
      <label>
        <span>Height</span>
        <Input
          value={value.height}
          inputmode="numeric"
          disabled={readonly}
          aria-label={`${field.label} height`}
          oninput={(event) => commit("height", event.currentTarget.value)}
        />
      </label>
    </div>
    {#if !readonly}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${field.label} reference`}
        onclick={removeReference}
      >
        <TrashIcon aria-hidden="true" />
      </Button>
    {/if}
  {:else}
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={readonly}
      onclick={addReference}
    >
      <ImagePlusIcon data-icon="inline-start" aria-hidden="true" />
      {addLabel}
    </Button>
  {/if}
</div>
