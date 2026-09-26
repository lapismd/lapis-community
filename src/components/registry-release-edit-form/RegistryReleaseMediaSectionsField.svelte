<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import ImagePlusIcon from "@lucide/svelte/icons/image-plus";

  import type { RegisteredFormRendererProps } from "@lapismd/design-core/forms";

  import RegistryReleaseGalleryField from "./RegistryReleaseGalleryField.svelte";
  import RegistryReleaseImageSetEditor from "./RegistryReleaseImageSetEditor.svelte";
  import {
    createBlankImageSet,
    type RegistryReleaseEditDraft,
    type RegistryReleaseImageSetDraft,
  } from "./model.js";
  import "./RegistryReleaseMediaSectionsField.css";

  type MediaDraft = RegistryReleaseEditDraft["media"];
  type ImageSetKey = "logo" | "banner" | "overview";
  type MediaTabKey = ImageSetKey | "screenshots";
  type Props = RegisteredFormRendererProps<
    "registry-media-sections",
    RegistryReleaseEditDraft
  >;

  const imageTabs = [
    { key: "logo", label: "Logo", addLabel: "Add logo image" },
    { key: "banner", label: "Banner", addLabel: "Add banner image" },
    {
      key: "overview",
      label: "Overview",
      addLabel: "Add overview image",
    },
  ] as const;

  let {
    root,
    value,
    field,
    view,
    context,
    issues = [],
    readonly = false,
    update,
    updateRoot,
  }: Props = $props();

  let activeTab = $state<MediaTabKey>("logo");
  const galleryField = $derived({
    id: `${field.id}-gallery`,
    kind: "registry-gallery",
    label: "Screenshots",
    addLabel: "Add screenshot",
  } as never);

  function updateImageSet(
    key: ImageSetKey,
    imageSet: RegistryReleaseImageSetDraft | null,
  ): void {
    if (readonly) return;
    void update({ ...value, [key]: imageSet });
  }

  function addImageSet(key: ImageSetKey): void {
    const option = imageTabs.find((item) => item.key === key);
    if (!option || readonly) return;
    updateImageSet(key, createBlankImageSet(option.label));
  }

  function updateGallery(gallery: MediaDraft["gallery"]): void {
    if (readonly) return;
    void update({ ...value, gallery });
  }
</script>

<Tabs.Root
  bind:value={activeTab}
  class="registry-release-media-tabs"
  data-ui-part="registry-release-media-tabs"
>
  <div class="registry-release-media-tabs__surface">
    <Tabs.List
      class="registry-release-media-tabs__list"
      aria-label="Release media assets"
    >
      {#each imageTabs as tab (tab.key)}
        <Tabs.Trigger
          class="registry-release-media-tabs__trigger"
          value={tab.key}
        >
          {tab.label}
        </Tabs.Trigger>
      {/each}
      <Tabs.Trigger
        class="registry-release-media-tabs__trigger"
        value="screenshots"
      >
        Screenshots
      </Tabs.Trigger>
    </Tabs.List>

    <div class="registry-release-media-tabs__content">
      {#each imageTabs as tab (tab.key)}
        {@const imageSet = value[tab.key]}
        <Tabs.Content
          value={tab.key}
          class="registry-release-media-tabs__panel"
        >
          {#if activeTab === tab.key}
            {#if imageSet}
              <RegistryReleaseImageSetEditor
                value={imageSet}
                itemLabel={tab.label}
                {readonly}
                update={(next) => updateImageSet(tab.key, next)}
                onEmpty={() => updateImageSet(tab.key, null)}
              />
            {:else}
              <div class="registry-release-media-tabs__empty">
                <ImagePlusIcon aria-hidden="true" />
                <span>{tab.label} image missing</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="registry-release-media-tabs__add"
                  disabled={readonly}
                  onclick={() => addImageSet(tab.key)}
                >
                  {tab.addLabel}
                </Button>
              </div>
            {/if}
          {/if}
        </Tabs.Content>
      {/each}

      <Tabs.Content
        value="screenshots"
        class="registry-release-media-tabs__panel"
      >
        {#if activeTab === "screenshots"}
          <RegistryReleaseGalleryField
            {root}
            value={value.gallery}
            field={galleryField}
            {view}
            {context}
            {issues}
            {readonly}
            update={updateGallery}
            {updateRoot}
            sectioned
          />
        {/if}
      </Tabs.Content>
    </div>
  </div>
</Tabs.Root>
