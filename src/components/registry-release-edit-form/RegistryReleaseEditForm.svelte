<script lang="ts">
  import {
    createFormRendererRegistry,
    FormToolbar,
    StructuredForm,
  } from "@lapismd/design-core/forms";
  import { createFormController } from "@lapismd/design-core/forms/core";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import SaveIcon from "@lucide/svelte/icons/save";
  import XIcon from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";

  import type { RegistryResolvedDetail } from "../../registry/model.js";
  import RegistryReleaseGalleryField from "./RegistryReleaseGalleryField.svelte";
  import RegistryReleaseMediaReferenceField from "./RegistryReleaseMediaReferenceField.svelte";
  import "./RegistryReleaseEditForm.css";
  import { registryReleaseEditConfig } from "./form-config.js";
  import {
    draftFromResolvedDetail,
    type RegistryReleaseEditDraftOptions,
    type RegistryReleaseEditDraft,
  } from "./model.js";

  let {
    resolved,
    releaseEventId,
    manifestSha256,
    publisherIdentity,
    onSave = () => {},
    onCancel = () => {},
  }: {
    resolved: RegistryResolvedDetail;
    releaseEventId?: string;
    manifestSha256?: string;
    publisherIdentity?: string;
    onSave?: (draft: RegistryReleaseEditDraft) => void | Promise<void>;
    onCancel?: () => void | Promise<void>;
  } = $props();

  function draftOptions(): RegistryReleaseEditDraftOptions {
    const options: RegistryReleaseEditDraftOptions = {};
    if (releaseEventId !== undefined) options.releaseEventId = releaseEventId;
    if (manifestSha256 !== undefined) options.manifestSha256 = manifestSha256;
    if (publisherIdentity !== undefined)
      options.publisherIdentity = publisherIdentity;
    return options;
  }

  function createDraft(): RegistryReleaseEditDraft {
    return draftFromResolvedDetail(resolved, draftOptions());
  }

  let draft = $state<RegistryReleaseEditDraft>(untrack(createDraft));
  let saving = $state(false);
  const controller = createFormController<RegistryReleaseEditDraft>({
    defaultValues: untrack(createDraft),
    validationMode: "onTouched",
  });
  const registry = createFormRendererRegistry();
  registry.register("registry-media-reference", {
    component: RegistryReleaseMediaReferenceField,
    wrapper: "field",
    align: "start",
    as: "div",
  });
  registry.register("registry-gallery", {
    component: RegistryReleaseGalleryField,
    wrapper: "none",
  });
  const collapsedAll = $derived(controller.allDisclosuresCollapsed());
  const blockingIssues = $derived(
    controller.issues.filter(
      (issue) => (issue.severity ?? "error") === "error",
    ),
  );

  $effect(() => {
    const nextDraft = createDraft();
    untrack(() => {
      draft = nextDraft;
      controller.reset(nextDraft, { emit: false });
    });
  });

  async function save(): Promise<void> {
    if (!(await controller.validate())) {
      const firstPath = controller.issues.find(
        (issue) => (issue.severity ?? "error") === "error" && issue.path,
      )?.path;
      if (firstPath) controller.focus(firstPath as never, { select: true });
      return;
    }
    saving = true;
    try {
      await onSave(draft);
    } finally {
      saving = false;
    }
  }

  async function cancel(): Promise<void> {
    const nextDraft = createDraft();
    draft = nextDraft;
    controller.reset(nextDraft, { emit: false });
    await onCancel();
  }
</script>

<form
  class="registry-release-edit-form"
  data-ui-part="registry-release-edit-form"
  aria-label={`${draft.plugin.name} release edit form`}
  onsubmit={(event) => {
    event.preventDefault();
    void save();
  }}
>
  <FormToolbar
    {collapsedAll}
    collapseLabel="Collapse all release edit sections"
    expandLabel="Expand all release edit sections"
    onToggleCollapse={() =>
      collapsedAll ? controller.expandAll() : controller.collapseAll()}
  >
    {#snippet leading()}
      <span class="registry-release-edit-form__title"
        >{draft.plugin.name} pending release</span
      >
    {/snippet}
    {#snippet actions()}
      <Button type="button" variant="ghost" size="sm" onclick={cancel}>
        <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
        Reset
      </Button>
    {/snippet}
  </FormToolbar>

  <div class="registry-release-edit-form__body">
    <StructuredForm
      value={draft}
      config={registryReleaseEditConfig}
      {controller}
      {registry}
      onChange={(next) => {
        draft = next;
      }}
    />
    {#if blockingIssues.length}
      <div class="registry-release-edit-form__errors" role="alert">
        <strong>Review required release fields</strong>
        {#each blockingIssues as issue, index (`${issue.path ?? issue.fieldId ?? "form"}-${index}`)}
          <p>{issue.message}</p>
        {/each}
      </div>
    {/if}
  </div>

  <div class="registry-release-edit-form__footer">
    <Button type="button" variant="outline" onclick={cancel}>
      <XIcon data-icon="inline-start" aria-hidden="true" />
      Cancel
    </Button>
    <Button type="submit" disabled={saving}>
      <SaveIcon data-icon="inline-start" aria-hidden="true" />
      {saving ? "Saving..." : "Save draft"}
    </Button>
  </div>
</form>
