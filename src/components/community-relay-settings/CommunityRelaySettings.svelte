<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";

  import { Button } from "@lapismd/design-core/shadcn/button";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";

  import type {
    CommunityCacheState,
    CommunityConnectionSettings,
    CommunityOperationState,
  } from "../../community/index.js";

  let {
    open = $bindable(false),
    connection,
    operation,
    cache,
    onSave,
    onReset,
    onClearCache,
  }: {
    open?: boolean;
    connection: CommunityConnectionSettings;
    operation?: CommunityOperationState;
    cache?: CommunityCacheState;
    onSave: (relayUrl: string) => Promise<void>;
    onReset: () => Promise<void>;
    onClearCache?: () => Promise<void>;
  } = $props();

  let relayUrl = $state("");
  let localError = $state("");
  let clearConfirmationOpen = $state(false);
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

  async function reset(): Promise<void> {
    localError = "";
    try {
      await onReset();
      open = false;
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : "The app default relay could not be restored";
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1_024) return `${bytes} B`;
    if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KiB`;
    return `${(bytes / (1_024 * 1_024)).toFixed(1)} MiB`;
  }
</script>

<Dialog.Root bind:open>
  <DialogFrame aria-label="Community settings" size="form">
    {#snippet title()}Edit Community{/snippet}
    {#snippet description()}
      Update this community's relay URL.
    {/snippet}

    <form
      id="communityrelaysettings-form-0"
      class="community-relay-settings__form"
      onsubmit={save}
    >
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
          <div class="community-relay-settings__source">
            <Field.Description>
              {connection.relayUrlSource === "override"
                ? `Using a saved override. App default: ${connection.defaultRelayUrl}`
                : "Using the app-provided default relay."}
            </Field.Description>
            {#if connection.relayUrlSource === "override"}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onclick={() => void reset()}
              >
                Use app default
              </Button>
            {/if}
          </div>
          {#if error}
            <Field.Error>{error}</Field.Error>
          {/if}
        </Field.Field>
      </Field.Group>

      {#if cache}
        <section class="community-relay-settings__local-data">
          <div>
            <h3>Local data</h3>
            <p>
              {cache.mode === "turso-opfs"
                ? "Turso OPFS"
                : cache.mode === "indexeddb"
                  ? "IndexedDB"
                  : "Memory only"}
              · {formatBytes(cache.approximateBytes ?? 0)}
            </p>
            <p>
              {cache.lastSynchronizedAt === undefined
                ? "Not synchronized yet"
                : `Last synchronized ${new Date(cache.lastSynchronizedAt * 1_000).toLocaleString()}`}
            </p>
            {#if cache.degradedReason}
              <p class="community-relay-settings__degraded">
                {cache.degradedReason}
              </p>
            {/if}
          </div>
          {#if onClearCache}
            <Button
              type="button"
              variant="outline"
              onclick={() => (clearConfirmationOpen = true)}>Clear cache</Button
            >
          {/if}
        </section>
      {/if}
    </form>

    {#snippet footer()}
      <Button
        form="communityrelaysettings-form-0"
        type="button"
        variant="outline"
        disabled={pending}
        onclick={() => (open = false)}
      >
        Cancel
      </Button>
      <Button
        form="communityrelaysettings-form-0"
        type="submit"
        disabled={pending || relayUrl.trim() === ""}
      >
        {pending ? "Connecting…" : "Save Changes"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>

<ConfirmDialog
  bind:open={clearConfirmationOpen}
  destructive
  onConfirm={async () => {
    await onClearCache?.();
  }}
>
  {#snippet title()}Clear local community data?{/snippet}
  {#snippet description()}
    Cached public events will be removed and rebuilt from the relay on the next
    connection. Nostr events on the relay are not affected.
  {/snippet}
  {#snippet confirmLabel()}Clear cache{/snippet}
</ConfirmDialog>

<style>
  .community-relay-settings__form {
    display: grid;
    gap: 1.5rem;
  }

  :global(.community-relay-settings__fields[data-ui-part="field-group"]) {
    gap: 1rem;
  }

  .community-relay-settings__source {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .community-relay-settings__source :global([data-ui-component="button"]) {
    flex: none;
  }

  .community-relay-settings__local-data {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .community-relay-settings__local-data h3,
  .community-relay-settings__local-data p {
    margin: 0;
  }

  .community-relay-settings__local-data p {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-relay-settings__degraded {
    color: var(--destructive) !important;
  }
</style>
