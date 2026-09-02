<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";

  import type {
    CommunityConnectionSettings,
    CommunityOperationState,
  } from "../../community/index.js";

  let {
    open = $bindable(false),
    connection,
    operation,
    onSave,
  }: {
    open?: boolean;
    connection: CommunityConnectionSettings;
    operation?: CommunityOperationState;
    onSave: (relayUrl: string) => Promise<void>;
  } = $props();

  let relayUrl = $state("");
  let localError = $state("");
  const pending = $derived(operation?.status === "pending");
  const error = $derived(localError || operation?.message || "");

  $effect(() => {
    if (!open) return;
    relayUrl = connection.relayUrl;
    localError = "";
  });

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    localError = "";
    try {
      await onSave(relayUrl);
      open = false;
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : "Relay settings could not be saved";
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    class="community-relay-settings"
    aria-label="Community settings"
  >
    <form class="community-relay-settings__form" onsubmit={save}>
      <Dialog.Header>
        <Dialog.Title>Edit Community</Dialog.Title>
        <Dialog.Description>
          Update this community's relay URL.
        </Dialog.Description>
      </Dialog.Header>

      <Field.Group class="community-relay-settings__fields">
        <Field.Field data-disabled>
          <Field.Label for="community-settings-name">Name</Field.Label>
          <Input
            id="community-settings-name"
            value={connection.name}
            disabled
          />
        </Field.Field>
        <Field.Field data-invalid={error ? "" : undefined}>
          <Field.Label for="community-settings-relay-url">
            Relay URL
          </Field.Label>
          <Input
            id="community-settings-relay-url"
            type="url"
            bind:value={relayUrl}
            placeholder="wss://relay.example.com"
            aria-invalid={error ? true : undefined}
            required
          />
          {#if error}
            <Field.Error>{error}</Field.Error>
          {/if}
        </Field.Field>
      </Field.Group>

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onclick={() => (open = false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending || relayUrl.trim() === ""}>
          {pending ? "Connecting…" : "Save Changes"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-relay-settings) {
    width: min(calc(100vw - 2rem), 31rem);
  }

  .community-relay-settings__form {
    display: grid;
    gap: 1.5rem;
  }

  :global(.community-relay-settings__fields[data-ui-part="field-group"]) {
    gap: 1rem;
  }
</style>
