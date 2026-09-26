<script lang="ts">
  import {
    AddSectionChooser,
    FormSectionHeader,
    type RegisteredFormRendererProps,
  } from "@lapismd/design-core/forms";
  import type { FormController } from "@lapismd/design-core/forms/core";

  import RegistryReleaseGalleryField from "./RegistryReleaseGalleryField.svelte";
  import RegistryReleaseMediaReferenceField from "./RegistryReleaseMediaReferenceField.svelte";
  import {
    createBlankMediaReference,
    type RegistryReleaseEditDraft,
    type RegistryReleaseMediaReferenceDraft,
  } from "./model.js";
  import "./RegistryReleaseMediaSectionsField.css";

  type MediaDraft = RegistryReleaseEditDraft["media"];
  type MediaReferenceKey = "logo" | "banner" | "overview";
  type Props = RegisteredFormRendererProps<
    "registry-media-sections",
    RegistryReleaseEditDraft
  > & {
    controller?: FormController<RegistryReleaseEditDraft>;
    disclosureGroup?: string;
  };

  const referenceOptions = [
    { key: "logo", label: "Logo", addLabel: "Add logo reference" },
    { key: "banner", label: "Banner", addLabel: "Add banner reference" },
    {
      key: "overview",
      label: "Overview image",
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
    controller,
    disclosureGroup = "media",
  }: Props = $props();

  let chooserOpen = $state(false);
  let chooserTitle = $state("New media reference");
  let localClosed = $state<Set<string>>(new Set());

  const presentReferences = $derived(
    referenceOptions.filter((option) => value[option.key] !== null),
  );
  const addOptions = $derived(
    referenceOptions
      .filter((option) => value[option.key] === null)
      .map((option) => ({ value: option.key, label: option.label })),
  );
  const visibleSectionIds = $derived([
    ...presentReferences.map((option) => option.key),
    "gallery",
  ]);
  const totalSections = $derived(visibleSectionIds.length);
  const galleryField = $derived({
    id: `${field.id}-gallery`,
    kind: "registry-gallery",
    label: "Screenshot carousel",
    addLabel: "Add screenshot",
  } as never);

  $effect(() => {
    if (!controller) return;
    for (const sectionId of visibleSectionIds) {
      controller.registerDisclosure(disclosureId(sectionId), disclosureGroup);
    }
  });

  function disclosureId(sectionId: string): string {
    return `${field.id}:${sectionId}`;
  }

  function sectionOpen(sectionId: string): boolean {
    if (controller) return controller.isDisclosureOpen(disclosureId(sectionId));
    return !localClosed.has(sectionId);
  }

  function toggleSection(sectionId: string): void {
    if (controller) {
      controller.toggleDisclosure(disclosureId(sectionId));
      return;
    }
    const next = new Set(localClosed);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    localClosed = next;
  }

  function updateReference(
    key: MediaReferenceKey,
    reference: RegistryReleaseMediaReferenceDraft | null,
  ): void {
    if (readonly) return;
    void update({ ...value, [key]: reference });
  }

  function addReference(key: string): void {
    const option = referenceOptions.find((item) => item.key === key);
    if (!option || readonly) return;
    updateReference(option.key, createBlankMediaReference(option.label));
    chooserOpen = false;
    chooserTitle = "New media reference";
  }

  function updateGallery(gallery: MediaDraft["gallery"]): void {
    if (readonly) return;
    void update({ ...value, gallery });
  }

  function referenceField(option: (typeof referenceOptions)[number]) {
    return {
      label: option.label,
      addLabel: option.addLabel,
    };
  }
</script>

<div
  class="registry-release-media-sections"
  data-ui-part="registry-release-media-sections"
>
  {#each presentReferences as option, index (option.key)}
    {@const reference = value[option.key]}
    {@const open = sectionOpen(option.key)}
    <article
      class="registry-release-media-section"
      data-ui-part="registry-release-media-section"
    >
      <FormSectionHeader
        title={option.label}
        {index}
        total={totalSections}
        {open}
        editable={false}
        movable={false}
        removable={!readonly}
        titleToggleable
        removeLabel={`Remove ${option.label} reference`}
        titleRowClass="registry-release-media-section__title-row"
        onRemove={() => updateReference(option.key, null)}
        onToggle={() => toggleSection(option.key)}
      />
      {#if open && reference}
        <div class="registry-release-media-section__body">
          <RegistryReleaseMediaReferenceField
            value={reference}
            field={referenceField(option)}
            {readonly}
            update={(next) => updateReference(option.key, next)}
            sectioned
          />
        </div>
      {/if}
    </article>
  {/each}

  <article
    class="registry-release-media-section"
    data-ui-part="registry-release-media-section"
  >
    <FormSectionHeader
      title="Screenshot carousel"
      index={presentReferences.length}
      total={totalSections}
      open={sectionOpen("gallery")}
      editable={false}
      movable={false}
      removable={false}
      titleToggleable
      titleRowClass="registry-release-media-section__title-row"
      onToggle={() => toggleSection("gallery")}
    />
    {#if sectionOpen("gallery")}
      <div
        class="registry-release-media-section__body registry-release-media-section__body--gallery"
      >
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
      </div>
    {/if}
  </article>

  {#if addOptions.length > 0 && !readonly}
    <AddSectionChooser
      open={chooserOpen}
      title={chooserTitle}
      addLabel={field.addLabel ?? "Add media reference"}
      inputLabel="Media reference title"
      optionLabel="Media type"
      options={addOptions}
      onOpen={() => (chooserOpen = true)}
      onCancel={() => {
        chooserOpen = false;
        chooserTitle = "New media reference";
      }}
      onTitleChange={(title) => (chooserTitle = title)}
      onChoose={addReference}
    />
  {/if}
</div>
