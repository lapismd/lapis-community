<script lang="ts">
  import {
    SortableArrayItem,
    type RegisteredFormRendererProps,
  } from "@lapismd/design-core/forms";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { onDestroy } from "svelte";

  import type { RegistryReleaseEditDraft } from "./model.js";
  import RegistryReleaseProseComposer from "./RegistryReleaseProseComposer.svelte";
  import "./RegistryReleaseHighlightsField.css";

  type Props = RegisteredFormRendererProps<
    "registry-highlight-list",
    RegistryReleaseEditDraft
  > & {
    blur?: () => void;
  };

  let {
    value = [],
    field,
    issues = [],
    readonly = false,
    update,
    blur = () => {},
  }: Props = $props();

  let draggingIndex = $state<number | null>(null);
  const items = $derived(Array.isArray(value) ? value : []);
  const error = $derived(issues[0]?.message ?? null);
  const errorId = $derived(error ? `${field.id}-issues` : undefined);
  const addLabel = $derived(field.addLabel ?? "Add highlight");

  function commit(next: string[]): void {
    if (!readonly) void update(next);
  }

  function updateItem(index: number, item: string): void {
    const next = [...items];
    next[index] = item;
    commit(next);
  }

  function add(): void {
    commit([...items, ""]);
  }

  function remove(index: number): void {
    commit(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function arrayMove(values: string[], from: number, to: number): string[] {
    const next = [...values];
    const [item] = next.splice(from, 1);
    if (item === undefined) return values;
    next.splice(to, 0, item);
    return next;
  }

  function move(index: number, delta: -1 | 1): void {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    commit(arrayMove(items, index, nextIndex));
  }

  function startDrag(event: PointerEvent, index: number): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    draggingIndex = index;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag, { once: true });
    window.addEventListener("pointercancel", finishDrag, { once: true });
  }

  function handlePointerMove(event: PointerEvent): void {
    if (draggingIndex === null) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const item = element?.closest("[data-sortable-item]") as HTMLElement | null;
    const targetIndex = Number(item?.dataset.sortableIndex);
    if (
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= items.length ||
      targetIndex === draggingIndex
    ) {
      return;
    }
    commit(arrayMove(items, draggingIndex, targetIndex));
    draggingIndex = targetIndex;
  }

  function finishDrag(): void {
    draggingIndex = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", finishDrag);
    window.removeEventListener("pointercancel", finishDrag);
  }

  onDestroy(finishDrag);
</script>

<div
  class="registry-release-highlights cv-control-row-group"
  data-ui-component="list-editor"
  data-ui-part="list-editor"
  data-invalid={error ? "" : undefined}
>
  <div
    class="registry-release-highlights__header cv-control-action-row"
    data-ui-component="list-editor"
    data-ui-part="list-editor-header"
  >
    <span
      class="cv-control-action-row__label"
      data-ui-component="list-editor"
      data-ui-part="list-editor-label"
    >
      {field.label}
    </span>
    {#if !readonly}
      <div class="cv-control-action-row__control">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          class="ui-list-editor__add"
          onclick={add}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {addLabel}
        </Button>
      </div>
    {/if}
  </div>

  <div data-ui-component="list-editor" data-ui-part="list-editor-items">
    {#each items as item, index (`${field.id}-${index}`)}
      {#if readonly}
        <SortableArrayItem
          id={`${field.id}-${index}`}
          {index}
          dragging={false}
          compact
          removable={false}
          dragLabel={`Drag highlight ${index + 1}`}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
        >
          <div
            data-ui-component="list-editor"
            data-ui-part="list-editor-item-body"
          >
            <RegistryReleaseProseComposer
              value={item}
              label={`Highlight ${index + 1}`}
              placeholder="Add highlight"
              {readonly}
              update={(next) => updateItem(index, next)}
              {blur}
            />
          </div>
        </SortableArrayItem>
      {:else}
        <SortableArrayItem
          id={`${field.id}-${index}`}
          {index}
          dragging={draggingIndex === index}
          compact
          removable
          dragLabel={`Drag highlight ${index + 1}`}
          canMoveUp={index > 0}
          canMoveDown={index < items.length - 1}
          onDragStart={startDrag}
          onKeyboardMove={move}
          onRemove={() => remove(index)}
        >
          <div
            data-ui-component="list-editor"
            data-ui-part="list-editor-item-body"
          >
            <RegistryReleaseProseComposer
              value={item}
              label={`Highlight ${index + 1}`}
              placeholder="Add highlight"
              {readonly}
              update={(next) => updateItem(index, next)}
              {blur}
            />
          </div>
        </SortableArrayItem>
      {/if}
    {/each}
  </div>

  {#if error}
    <p
      id={errorId}
      data-ui-component="list-editor"
      data-ui-part="list-editor-error"
      role="alert"
    >
      {error}
    </p>
  {/if}
</div>
