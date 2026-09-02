<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";

  import type {
    CommunityOperationState,
    CommunityRoomUpdate,
  } from "../../community/index.js";
  import type { CommunityRoomKind } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    mode = "edit",
    roomKind,
    initial,
    retentionSupported = false,
    operation,
    onSave,
  }: {
    open?: boolean;
    mode?: "create" | "edit";
    roomKind: Exclude<CommunityRoomKind, "direct">;
    initial?: Partial<CommunityRoomUpdate>;
    retentionSupported?: boolean;
    operation?: CommunityOperationState;
    onSave: (update: CommunityRoomUpdate) => Promise<void>;
  } = $props();

  let name = $state("");
  let description = $state("");
  let visibility = $state<"public" | "private">("public");
  let lifecycle = $state<"ongoing" | "temporary">("ongoing");
  let localError = $state("");
  const noun = $derived(roomKind === "forum" ? "forum" : "channel");
  const error = $derived(localError || operation?.message || "");
  const pending = $derived(operation?.status === "pending");

  $effect(() => {
    if (!open) return;
    name = initial?.name ?? "";
    description = initial?.description ?? "";
    visibility = initial?.visibility ?? "public";
    lifecycle = initial?.lifecycle ?? "ongoing";
    localError = "";
  });

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    localError = "";
    try {
      await onSave({ name, description, visibility, lifecycle });
      open = false;
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : `Could not save ${noun}`;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="community-room-editor">
    <form class="community-room-editor__form" onsubmit={save}>
      <Dialog.Header>
        <Dialog.Title
          >{mode === "create" ? "Create" : "Edit"} {noun}</Dialog.Title
        >
        <Dialog.Description>
          Set the name, description, visibility, and lifecycle for this {noun}.
        </Dialog.Description>
      </Dialog.Header>
      <Field.Group>
        <Field.Field data-invalid={error ? "" : undefined}>
          <Field.Label for="community-room-name">Name</Field.Label>
          <Input id="community-room-name" bind:value={name} required />
        </Field.Field>
        <Field.Field>
          <Field.Label for="community-room-description">Description</Field.Label
          >
          <Textarea
            id="community-room-description"
            bind:value={description}
            rows={3}
          />
        </Field.Field>
        <Field.Field>
          <Field.Legend>Visibility</Field.Legend>
          <div class="community-room-editor__choices">
            <Button
              type="button"
              variant={visibility === "public" ? "secondary" : "outline"}
              onclick={() => (visibility = "public")}>Public</Button
            >
            <Button
              type="button"
              variant={visibility === "private" ? "secondary" : "outline"}
              onclick={() => (visibility = "private")}>Private</Button
            >
          </div>
          <Field.Description
            >Public rooms can be read without signing in when the relay permits
            it.</Field.Description
          >
        </Field.Field>
        <Field.Field>
          <Field.Legend>Channel type</Field.Legend>
          <div class="community-room-editor__choices">
            <Button
              type="button"
              variant={lifecycle === "ongoing" ? "secondary" : "outline"}
              onclick={() => (lifecycle = "ongoing")}>Ongoing</Button
            >
            <Button
              type="button"
              variant="outline"
              disabled={!retentionSupported}
              title={retentionSupported
                ? "Temporary room"
                : "This relay does not advertise configurable group retention"}
              onclick={() => (lifecycle = "temporary")}>Temporary</Button
            >
          </div>
          {#if !retentionSupported}<Field.Description
              >Temporary rooms are unavailable because this relay does not
              advertise group retention.</Field.Description
            >{/if}
        </Field.Field>
        {#if error}<Field.Error>{error}</Field.Error>{/if}
      </Field.Group>
      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onclick={() => (open = false)}>Cancel</Button
        >
        <Button type="submit" disabled={pending || name.trim() === ""}
          >{pending ? "Saving…" : "Save"}</Button
        >
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-room-editor) {
    width: min(calc(100vw - 2rem), 34rem);
  }
  .community-room-editor__form {
    display: grid;
    gap: 1.5rem;
  }
  .community-room-editor__choices {
    display: flex;
    gap: 0.5rem;
  }
</style>
