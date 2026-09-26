<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import ImagePlusIcon from "@lucide/svelte/icons/image-plus";
  import TrashIcon from "@lucide/svelte/icons/trash-2";

  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import {
    createBlankGalleryItem,
    type RegistryReleaseGalleryItemDraft,
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

  const items = $derived(Array.isArray(value) ? value : []);
  const addLabel = $derived(field.addLabel ?? "Add screenshot");

  function commit(next: RegistryReleaseGalleryItemDraft[]): void {
    if (readonly) return;
    void update(next);
  }

  function updateItem(
    index: number,
    key: keyof RegistryReleaseGalleryItemDraft,
    nextValue: string,
  ): void {
    const next = [...items];
    const item = next[index];
    if (!item) return;
    next[index] = { ...item, [key]: nextValue };
    commit(next);
  }

  function addItem(): void {
    commit([...items, createBlankGalleryItem(items.length)]);
  }

  function moveItem(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    commit(next);
  }

  function removeItem(index: number): void {
    commit(items.filter((_, itemIndex) => itemIndex !== index));
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
      variant="outline"
      size="sm"
      disabled={readonly}
      onclick={addItem}
    >
      <ImagePlusIcon data-icon="inline-start" aria-hidden="true" />
      {addLabel}
    </Button>
  </div>

  {#if items.length}
    <ul class="registry-release-gallery__rail">
      {#each items as item, index (item.id)}
        <li class="registry-release-gallery__item">
          <div class="registry-release-gallery__preview">
            {#if item.url}
              <img src={item.url} alt="" loading="lazy" />
            {:else}
              <ImagePlusIcon aria-hidden="true" />
            {/if}
          </div>
          <div class="registry-release-gallery__item-header">
            <strong>{item.alt || `Screenshot ${index + 1}`}</strong>
            <div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move screenshot ${index + 1} left`}
                disabled={readonly || index === 0}
                onclick={() => moveItem(index, -1)}
              >
                <ArrowLeftIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move screenshot ${index + 1} right`}
                disabled={readonly || index === items.length - 1}
                onclick={() => moveItem(index, 1)}
              >
                <ArrowRightIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove screenshot ${index + 1}`}
                disabled={readonly}
                onclick={() => removeItem(index)}
              >
                <TrashIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div class="registry-release-gallery__fields">
            <label>
              <span>Alt text</span>
              <Input
                value={item.alt}
                disabled={readonly}
                aria-label={`Screenshot ${index + 1} alt text`}
                oninput={(event) =>
                  updateItem(index, "alt", event.currentTarget.value)}
              />
            </label>
            <label>
              <span>Image URL</span>
              <Input
                value={item.url}
                disabled={readonly}
                aria-label={`Screenshot ${index + 1} image URL`}
                oninput={(event) =>
                  updateItem(index, "url", event.currentTarget.value)}
              />
            </label>
            <label>
              <span>Source URL</span>
              <Input
                value={item.sourceUrl}
                disabled={readonly}
                aria-label={`Screenshot ${index + 1} source URL`}
                oninput={(event) =>
                  updateItem(index, "sourceUrl", event.currentTarget.value)}
              />
            </label>
            <label>
              <span>SHA-256</span>
              <Input
                value={item.sha256}
                disabled={readonly}
                aria-label={`Screenshot ${index + 1} SHA-256`}
                oninput={(event) =>
                  updateItem(index, "sha256", event.currentTarget.value)}
              />
            </label>
            <div class="registry-release-gallery__numbers">
              <label>
                <span>Size</span>
                <Input
                  value={item.size}
                  inputmode="numeric"
                  disabled={readonly}
                  aria-label={`Screenshot ${index + 1} size bytes`}
                  oninput={(event) =>
                    updateItem(index, "size", event.currentTarget.value)}
                />
              </label>
              <label>
                <span>Width</span>
                <Input
                  value={item.width}
                  inputmode="numeric"
                  disabled={readonly}
                  aria-label={`Screenshot ${index + 1} width`}
                  oninput={(event) =>
                    updateItem(index, "width", event.currentTarget.value)}
                />
              </label>
              <label>
                <span>Height</span>
                <Input
                  value={item.height}
                  inputmode="numeric"
                  disabled={readonly}
                  aria-label={`Screenshot ${index + 1} height`}
                  oninput={(event) =>
                    updateItem(index, "height", event.currentTarget.value)}
                />
              </label>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="registry-release-gallery__empty">
      <ImagePlusIcon aria-hidden="true" />
      <span>No screenshots yet</span>
    </div>
  {/if}
</section>
