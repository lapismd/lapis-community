<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import Clock3Icon from "@lucide/svelte/icons/clock-3";
  import Globe2Icon from "@lucide/svelte/icons/globe-2";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LockIcon from "@lucide/svelte/icons/lock";
  import PencilLineIcon from "@lucide/svelte/icons/pencil-line";
  import UsersIcon from "@lucide/svelte/icons/users";
  import XIcon from "@lucide/svelte/icons/x";
  import { untrack } from "svelte";

  import type {
    CommunityOperationState,
    CommunityRoomUpdate,
  } from "../../community/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type { CommunityRoomKind } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    mode = "edit",
    roomKind,
    initial,
    retentionSupported = false,
    writerPolicySupported = false,
    operation,
    onSave,
  }: {
    open?: boolean;
    mode?: "create" | "edit";
    roomKind: Exclude<CommunityRoomKind, "direct">;
    initial?: Partial<CommunityRoomUpdate>;
    retentionSupported?: boolean;
    writerPolicySupported?: boolean;
    operation?: CommunityOperationState;
    onSave: (update: CommunityRoomUpdate) => Promise<void>;
  } = $props();

  let name = $state("");
  let description = $state("");
  let visibility = $state<"public" | "private">("public");
  let lifecycle = $state<"ongoing" | "temporary">("ongoing");
  let postingPolicy = $state<"standard" | "writers">("standard");
  let localError = $state("");
  let initializedOpen = false;
  const noun = $derived(roomKind === "forum" ? "forum" : "channel");
  const error = $derived(localError || operation?.message || "");
  const pending = $derived(operation?.status === "pending");

  $effect(() => {
    if (!open) {
      initializedOpen = false;
      return;
    }
    if (initializedOpen) return;
    initializedOpen = true;
    const openingInitial = untrack(() => initial);
    name = openingInitial?.name ?? "";
    description = openingInitial?.description ?? "";
    visibility = openingInitial?.visibility ?? "public";
    lifecycle = openingInitial?.lifecycle ?? "ongoing";
    postingPolicy = openingInitial?.postingPolicy ?? "standard";
    localError = "";
  });

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    localError = "";
    try {
      await onSave({
        name,
        description,
        visibility,
        lifecycle,
        ...(writerPolicySupported ? { postingPolicy } : {}),
      });
      open = false;
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : `Could not save ${noun}`;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="community-room-editor" showCloseButton={false}>
    <form class="community-room-editor__form" onsubmit={save}>
      <Dialog.Header class="community-room-editor__header">
        <Button
          class="community-room-editor__header-action"
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          title="Back"
          onclick={() => (open = false)}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
        <Dialog.Title>{mode === "create" ? "New" : "Edit"} {noun}</Dialog.Title>
        <Button
          class="community-room-editor__header-action"
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          title="Close"
          onclick={() => (open = false)}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </Dialog.Header>
      <Field.Group>
        <Field.Field data-invalid={error ? "" : undefined}>
          <Field.Label for="community-room-name">Name</Field.Label>
          <Input id="community-room-name" bind:value={name} required />
        </Field.Field>
        <Field.Field>
          <Field.Label
            >Description <span class="community-room-editor__optional"
              >Optional</span
            ></Field.Label
          >
          <CommunityChatComposer
            class="community-room-editor__description"
            bind:value={description}
            placeholder={`What this ${noun} is for`}
            ariaLabel={`${noun} description`}
            showSubmitButton={false}
          />
        </Field.Field>
        <div class="community-room-editor__option-row">
          <span class="community-room-editor__option-label">Type</span>
          <ToggleGroup.Root
            class="community-room-editor__choices"
            type="single"
            value={lifecycle}
            onValueChange={(value) => {
              if (value === "ongoing" || value === "temporary")
                lifecycle = value;
            }}
            size="sm"
            spacing={1}
            aria-label={`${noun} type`}
          >
            <ToggleGroup.Item
              value="temporary"
              disabled={!retentionSupported}
              title={retentionSupported
                ? `Temporary ${noun}`
                : "This relay does not advertise configurable group retention"}
            >
              <Clock3Icon />
              Temporary
            </ToggleGroup.Item>
            <ToggleGroup.Item value="ongoing">
              <HashIcon />
              Ongoing
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
        <div class="community-room-editor__option-row">
          <span class="community-room-editor__option-label">Visibility</span>
          <ToggleGroup.Root
            class="community-room-editor__choices"
            type="single"
            value={visibility}
            onValueChange={(value) => {
              if (value === "public" || value === "private") visibility = value;
            }}
            size="sm"
            spacing={1}
            aria-label="Visibility"
          >
            <ToggleGroup.Item value="private">
              <LockIcon />
              Private
            </ToggleGroup.Item>
            <ToggleGroup.Item value="public">
              <Globe2Icon />
              Public
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
        {#if writerPolicySupported}
          <div class="community-room-editor__option-row">
            <span class="community-room-editor__option-label"
              >Posting permissions</span
            >
            <ToggleGroup.Root
              class="community-room-editor__choices"
              type="single"
              value={postingPolicy}
              onValueChange={(value) => {
                if (value === "standard" || value === "writers")
                  postingPolicy = value;
              }}
              size="sm"
              spacing={1}
              aria-label="Posting permissions"
            >
              <ToggleGroup.Item
                value="standard"
                aria-label="Everyone with access"
                title={`Everyone with access can post in this ${noun}`}
              >
                <UsersIcon />
                Everyone
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="writers"
                aria-label="Writers and administrators"
                title="Only writers and relay administrators can post"
              >
                <PencilLineIcon />
                Writers
              </ToggleGroup.Item>
            </ToggleGroup.Root>
          </div>
        {/if}
        {#if error}<Field.Error>{error}</Field.Error>{/if}
      </Field.Group>
      <Dialog.Footer>
        <Button type="submit" disabled={pending || name.trim() === ""}
          >{pending
            ? mode === "create"
              ? "Creating…"
              : "Saving…"
            : mode === "create"
              ? `Create ${noun}`
              : "Save changes"}</Button
        >
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-room-editor) {
    width: min(calc(100vw - 2rem), 34rem);
    font-size: 0.82rem;
  }
  .community-room-editor__form {
    display: grid;
    gap: 1.5rem;
  }

  :global(.community-room-editor__header[data-ui-part="dialog-header"]) {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) 2rem;
    align-items: center;
    gap: 0.4rem;
  }

  :global(.community-room-editor__header [data-ui-part="dialog-title"]) {
    overflow: hidden;
    font-size: 0.9rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.community-room-editor__header-action[data-ui-component="button"]) {
    display: grid;
    width: 2rem;
    min-width: 2rem;
    height: 2rem;
    min-height: 2rem;
    place-items: center;
    border-radius: 999px;
    padding: 0;
    line-height: 0;
  }

  :global(
      .community-room-editor__header-action[data-ui-component="button"] svg
    ) {
    display: block;
    width: 0.75rem;
    height: 0.75rem;
    margin: 0;
  }

  :global(.community-room-editor [data-ui-component="input"]),
  :global(.community-room-editor [data-ui-part="field-label"]),
  :global(.community-room-editor [data-ui-part="toggle-group-item"]),
  :global(.community-room-editor [data-ui-component="button"]) {
    font-size: 0.82rem;
  }

  .community-room-editor__optional {
    color: var(--muted-foreground);
    font-weight: 400;
  }

  .community-room-editor__option-row {
    display: flex;
    min-height: 4.5rem;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    padding: 0.75rem 0.9rem;
  }

  .community-room-editor__option-label {
    font-weight: 500;
  }

  :global(.community-room-editor__choices[data-ui-component="toggle-group"]) {
    width: 15rem;
    flex: 0 0 15rem;
    gap: 0.2rem;
    border-radius: 0.75rem;
    background: var(--muted);
    padding: 0.2rem;
  }

  :global(
      .community-room-editor__choices[data-ui-component="toggle-group"]
        > [data-ui-part="toggle-group-item"]
    ) {
    min-width: 0;
    flex: 1 1 0;
    border-radius: 0.6rem;
    padding-inline: 0.75rem;
  }

  :global(
      .community-room-editor__choices[data-ui-component="toggle-group"]
        > [data-ui-part="toggle-group-item"][data-state="on"]
    ) {
    background: var(--background);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--foreground) 14%, transparent);
  }

  :global(.community-room-editor__description) {
    --community-chat-composer-editor-max-height-override: 7rem;
  }

  :global(
      .community-room-editor__description
        .community-chat-composer__surface[data-ui-component="ai-chat-composer"]
    ) {
    --ui-ai-chat-composer-radius: 0.8rem;
    box-shadow: none;
  }

  :global(
      .community-room-editor__description
        .community-chat-composer__surface[data-ui-component="ai-chat-composer"][data-elevation="low"]
        > [data-ui-part="body"]
    ) {
    box-shadow: inset 0 0 0 1px var(--border);
  }

  :global(
      .community-room-editor__description
        [data-ui-part="composer-editor-scroll-area"]
    ),
  :global(.community-room-editor__description .community-chat-composer__mira),
  :global(
      .community-room-editor__description
        .community-chat-composer__mira
        .cm-editor
    ) {
    min-height: 4.75rem;
  }

  @media (hover: hover) {
    :global(
        .community-room-editor__header-action[data-ui-component="button"]:hover
      ) {
      background: var(--muted);
      color: var(--foreground);
    }
  }

  @media (max-width: 36rem) {
    .community-room-editor__option-row {
      align-items: stretch;
      flex-direction: column;
    }

    :global(.community-room-editor__choices[data-ui-component="toggle-group"]) {
      width: 100%;
    }

    :global(
        .community-room-editor__choices[data-ui-component="toggle-group"]
          > [data-ui-part="toggle-group-item"]
      ) {
      min-width: 0;
      flex: 1;
    }
  }
</style>
