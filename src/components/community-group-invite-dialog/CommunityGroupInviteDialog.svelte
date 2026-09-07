<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import LinkIcon from "@lucide/svelte/icons/link";

  import type { CommunityGroupInvite } from "../../community/index.js";

  let {
    open = $bindable(false),
    mode,
    roomName,
    onCreate,
    onJoin,
    onCopy,
  }: {
    open?: boolean;
    mode: "create" | "join";
    roomName?: string;
    onCreate?: () => Promise<CommunityGroupInvite>;
    onJoin?: (value: string) => Promise<void>;
    onCopy?: (value: string) => Promise<void>;
  } = $props();

  let inviteValue = $state("");
  let createdInvite = $state<CommunityGroupInvite>();
  let pending = $state(false);
  let error = $state("");
  let copyStatus = $state<"idle" | "copied" | "failed">("idle");
  let wasOpen = false;

  const noun = $derived(roomName ? `“${roomName}”` : "a private group");

  $effect(() => {
    if (open && !wasOpen) {
      inviteValue = "";
      createdInvite = undefined;
      error = "";
      copyStatus = "idle";
    }
    wasOpen = open;
  });

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = "";
    copyStatus = "idle";
    pending = true;
    try {
      if (mode === "create") {
        if (onCreate === undefined)
          throw new Error("Invite creation is unavailable");
        createdInvite = await onCreate();
        inviteValue = createdInvite.uri;
      } else {
        if (onJoin === undefined)
          throw new Error("Invite joining is unavailable");
        await onJoin(inviteValue);
        open = false;
      }
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : "The relay rejected the invite";
    } finally {
      pending = false;
    }
  }

  async function copyInvite(): Promise<void> {
    if (createdInvite === undefined || onCopy === undefined) return;
    error = "";
    copyStatus = "idle";
    try {
      await onCopy(createdInvite.uri);
      copyStatus = "copied";
    } catch (cause) {
      copyStatus = "failed";
      error =
        cause instanceof Error
          ? cause.message
          : "Invite link could not be copied";
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="community-group-invite-dialog">
    <form class="community-group-invite-dialog__form" onsubmit={submit}>
      <Dialog.Header>
        <Dialog.Title>
          {mode === "create" ? "Create invite link" : "Join with invite"}
        </Dialog.Title>
        <Dialog.Description>
          {mode === "create"
            ? `Create a reusable invite for ${noun}. Anyone with the link can request access.`
            : "Paste a Community NIP-29 invite link. Community will only connect to a configured relay."}
        </Dialog.Description>
      </Dialog.Header>

      {#if mode === "join" || createdInvite}
        <Field.Field data-invalid={error ? "" : undefined}>
          <Field.Label for="community-group-invite-value">
            Invite link
          </Field.Label>
          <div class="community-group-invite-dialog__input-row">
            <Input
              id="community-group-invite-value"
              bind:value={inviteValue}
              readonly={mode === "create"}
              placeholder="nostr:naddr…?invite=…"
              autocomplete="off"
            />
            {#if mode === "create"}
              <Button
                type="button"
                variant="secondary"
                onclick={copyInvite}
                disabled={pending}
              >
                {#if copyStatus === "copied"}
                  <CheckIcon data-icon="inline-start" aria-hidden="true" />
                  Copied
                {:else}
                  <CopyIcon data-icon="inline-start" aria-hidden="true" />
                  Copy
                {/if}
              </Button>
            {/if}
          </div>
          {#if error}<Field.Error>{error}</Field.Error>{/if}
          {#if copyStatus === "copied"}
            <Field.Description role="status">
              Invite created and copied to the clipboard.
            </Field.Description>
          {:else if createdInvite}
            <Field.Description role="status">
              Invite created. Copy it when you are ready to share it.
            </Field.Description>
          {/if}
        </Field.Field>
      {:else}
        <div class="community-group-invite-dialog__preview" aria-hidden="true">
          <LinkIcon />
        </div>
        {#if error}<p class="community-group-invite-dialog__error" role="alert">
            {error}
          </p>{/if}
      {/if}

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onclick={() => (open = false)}
        >
          {createdInvite ? "Done" : "Cancel"}
        </Button>
        {#if mode === "join"}
          <Button type="submit" disabled={pending || inviteValue.trim() === ""}>
            {pending ? "Joining…" : "Join group"}
          </Button>
        {:else if !createdInvite}
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create invite"}
          </Button>
        {/if}
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-group-invite-dialog) {
    width: min(calc(100vw - 2rem), 32rem);
  }

  .community-group-invite-dialog__form {
    display: grid;
    gap: 1.25rem;
  }

  .community-group-invite-dialog__input-row {
    display: flex;
    gap: 0.5rem;
  }

  .community-group-invite-dialog__input-row :global(input) {
    min-width: 0;
    flex: 1;
  }

  .community-group-invite-dialog__preview {
    display: grid;
    width: 4rem;
    height: 4rem;
    margin-inline: auto;
    place-items: center;
    border-radius: 50%;
    color: var(--primary);
    background: var(--secondary);
  }

  :global(.community-group-invite-dialog__preview svg) {
    width: 1.75rem;
    height: 1.75rem;
  }

  .community-group-invite-dialog__error {
    margin: 0;
    color: var(--destructive);
    font-size: 0.875rem;
  }

  @media (max-width: 32rem) {
    .community-group-invite-dialog__input-row {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
