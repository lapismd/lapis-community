<script lang="ts">
  import {
    ConfirmDialog,
    DialogFrame,
  } from "@lapismd/design-core/forms/dialog";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import EyeOffIcon from "@lucide/svelte/icons/eye-off";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import UnlinkIcon from "@lucide/svelte/icons/unlink";

  import type {
    CommunityAccountSession,
    CommunityRelayAuthConfig,
    RelayCustodyTransferHandoff,
  } from "../../auth/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import {
    communityAccountCapability,
    communityAccountSignerDetails,
    communityGitHubActionLabel,
    formatCommunityAccountExpiry,
    type CommunityAccountAuthenticationState,
    type CommunityAccountManagementActions,
    type CommunityAccountResumeAction,
  } from "./model.js";
  import "./CommunityAccountSettings.css";

  let {
    account,
    config,
    actions,
    authenticationState,
    activeExternalSigner,
    resumeAction,
    busy = false,
    message = "",
    onCopyPublicKey,
    onConnectGitHub,
    onSignOut,
  }: {
    account?: CommunityAccountSession | undefined;
    config?: CommunityRelayAuthConfig | undefined;
    actions?: CommunityAccountManagementActions | undefined;
    authenticationState?: CommunityAccountAuthenticationState | undefined;
    activeExternalSigner?: "keytr" | undefined;
    resumeAction?: CommunityAccountResumeAction | undefined;
    busy?: boolean;
    message?: string;
    onCopyPublicKey?: ((pubkey: string) => void | Promise<void>) | undefined;
    onConnectGitHub?: (() => void | Promise<void>) | undefined;
    onSignOut?: (() => void | Promise<void>) | undefined;
  } = $props();

  let pendingAction = $state("");
  let localError = $state("");
  let localMessage = $state("");
  let disconnectGitHubOpen = $state(false);
  let disconnectSignerOpen = $state(false);
  let remoteSignerOpen = $state(false);
  let remoteSignerUrl = $state("");
  let transferOpen = $state(false);
  let transferHandoff = $state<RelayCustodyTransferHandoff>();
  let transferredNsec = $state("");
  let showTransferredNsec = $state(false);
  let transferImported = $state(false);
  let transferBunkerUrl = $state("");

  const signer = $derived(
    account === undefined
      ? undefined
      : communityAccountSignerDetails(
          account,
          authenticationState,
          activeExternalSigner,
        ),
  );
  const githubIdentity = $derived(
    account?.identities.find((identity) => identity.provider === "github"),
  );
  const githubAction = $derived(
    account === undefined
      ? undefined
      : communityGitHubActionLabel(account.github_status),
  );
  const authIdentity = $derived(
    account?.identities.find(
      (identity) => identity.provider === account.auth_provider,
    ),
  );
  const working = $derived(busy || pendingAction !== "");
  const copyPublicKeyAction = $derived(
    actions?.copyPublicKey ?? onCopyPublicKey,
  );
  const connectGitHubAction = $derived(
    actions?.connectGitHub ?? onConnectGitHub,
  );
  const signOutAction = $derived(actions?.signOut ?? onSignOut);
  const canRegisterPasskey = $derived(
    actions?.registerPasskey !== undefined &&
      communityAccountCapability(config, "passkey_registration"),
  );
  const canDisconnectGitHub = $derived(
    actions?.disconnectGitHub !== undefined &&
      communityAccountCapability(config, "github_disconnect"),
  );
  const canManageRemoteSigner = $derived(
    communityAccountCapability(config, "nip46_management") &&
      (actions?.connectRemoteSigner !== undefined ||
        actions?.switchRemoteSignerRelays !== undefined ||
        actions?.disconnectRemoteSigner !== undefined),
  );
  const canTransferCustody = $derived(
    actions?.beginCustodyTransfer !== undefined &&
      actions?.completeCustodyTransfer !== undefined &&
      communityAccountCapability(config, "custody_transfer"),
  );

  function providerLabel(value: string): string {
    if (value === "github") return "GitHub";
    if (value === "google") return "Google";
    if (value === "nostr") return "Nostr signer";
    return value;
  }

  function githubStatusLabel(value: string): string {
    return value.replaceAll("_", " ");
  }

  function errorMessage(cause: unknown): string {
    return cause instanceof Error
      ? cause.message
      : "The account change could not be completed.";
  }

  async function runAction(
    name: string,
    action: () => void | Promise<void>,
    success = "",
  ): Promise<boolean> {
    if (working) return false;
    pendingAction = name;
    localError = "";
    localMessage = "";
    try {
      await action();
      localMessage = success;
      return true;
    } catch (cause) {
      localError = errorMessage(cause);
      return false;
    } finally {
      pendingAction = "";
    }
  }

  async function copyValue(
    value: string,
    success: string,
    callback?: (value: string) => void | Promise<void>,
  ): Promise<void> {
    await runAction(
      "copy",
      async () => {
        if (callback !== undefined) await callback(value);
        else await navigator.clipboard.writeText(value);
      },
      success,
    );
  }

  async function registerPasskey(): Promise<void> {
    if (actions?.registerPasskey === undefined) return;
    if (
      await runAction(
        "passkey",
        actions.registerPasskey,
        "Passkey added to this account.",
      )
    ) {
      actions.clearResumeAction?.();
    }
  }

  async function connectGitHub(): Promise<void> {
    if (connectGitHubAction === undefined) return;
    await runAction("github", connectGitHubAction);
  }

  async function disconnectGitHub(): Promise<boolean> {
    if (actions?.disconnectGitHub === undefined) return false;
    return await runAction(
      "github-disconnect",
      actions.disconnectGitHub,
      "GitHub access disconnected. Your linked account identity is retained.",
    );
  }

  function openRemoteSigner(): void {
    localError = "";
    remoteSignerUrl = "";
    remoteSignerOpen = true;
  }

  async function connectRemoteSigner(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (actions?.connectRemoteSigner === undefined) return;
    const bunkerUrl = remoteSignerUrl.trim();
    if (bunkerUrl === "") {
      localError = "Enter the bunker URL supplied by your remote signer.";
      return;
    }
    if (
      await runAction(
        "remote-connect",
        () => actions.connectRemoteSigner?.(bunkerUrl),
        "Remote signer connected.",
      )
    ) {
      remoteSignerUrl = "";
      remoteSignerOpen = false;
    }
  }

  async function checkRemoteSignerRelays(): Promise<void> {
    if (actions?.switchRemoteSignerRelays === undefined) return;
    let relays: readonly string[] = [];
    if (
      await runAction("remote-relays", async () => {
        relays = await actions.switchRemoteSignerRelays!();
      })
    ) {
      localMessage =
        relays.length === 0
          ? "The remote signer did not advertise another relay."
          : `Remote signer relays refreshed: ${relays.join(", ")}`;
    }
  }

  async function disconnectRemoteSigner(): Promise<boolean> {
    if (actions?.disconnectRemoteSigner === undefined) return false;
    return await runAction(
      "remote-disconnect",
      actions.disconnectRemoteSigner,
      "Remote signer disconnected. Reconnect a signer to sign events.",
    );
  }

  function clearTransferSecret(): void {
    transferHandoff?.discardPrivateKey();
    transferHandoff = undefined;
    transferredNsec = "";
    showTransferredNsec = false;
    transferImported = false;
    transferBunkerUrl = "";
  }

  function changeTransferOpen(open: boolean): void {
    transferOpen = open;
    if (!open) clearTransferSecret();
  }

  function openTransfer(): void {
    localError = "";
    transferOpen = true;
  }

  async function beginTransfer(): Promise<void> {
    if (actions?.beginCustodyTransfer === undefined) return;
    clearTransferSecret();
    let handoff: RelayCustodyTransferHandoff | undefined;
    if (
      !(await runAction("custody-begin", async () => {
        handoff = await actions.beginCustodyTransfer!();
      })) ||
      handoff === undefined
    ) {
      return;
    }
    transferHandoff = handoff;
    transferredNsec = handoff.revealNsec();
    localMessage =
      "Private key revealed for transfer. Import it before completing this migration.";
  }

  async function completeTransfer(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const handoff = transferHandoff;
    const bunkerUrl = transferBunkerUrl.trim();
    if (
      actions?.completeCustodyTransfer === undefined ||
      handoff === undefined
    ) {
      return;
    }
    if (!transferImported || bunkerUrl === "") {
      localError =
        "Import the key, confirm that it is stored, and enter its bunker URL.";
      return;
    }
    if (
      await runAction(
        "custody-complete",
        () => actions.completeCustodyTransfer?.(handoff, bunkerUrl),
        "Signing moved to the remote signer.",
      )
    ) {
      transferHandoff = undefined;
      transferredNsec = "";
      transferImported = false;
      transferBunkerUrl = "";
      transferOpen = false;
    }
  }
</script>

<div
  class="community-account-settings"
  data-ui-component="community-account-settings"
  aria-labelledby="community-account-title"
  aria-busy={working}
>
  <header class="community-account-settings__heading">
    <h1 id="community-account-title">Account</h1>
    <p>Review how this Community account signs in and signs Nostr events.</p>
  </header>

  {#if resumeAction === "register-passkey"}
    <Alert.Root class="community-account-settings__notice">
      <ShieldCheckIcon aria-hidden="true" />
      <Alert.Title>Continue adding your passkey</Alert.Title>
      <Alert.Description>
        Your sign-in was refreshed. Finish adding a passkey to this account.
      </Alert.Description>
      {#if canRegisterPasskey}
        <Alert.Action>
          <Button size="sm" disabled={working} onclick={registerPasskey}
            >Continue</Button
          >
        </Alert.Action>
      {/if}
    </Alert.Root>
  {/if}

  {#if account === undefined}
    <section class="community-account-settings__empty">
      <h2>Direct signer</h2>
      <p>
        This signer is connected directly. Relay account and provider details
        are unavailable.
      </p>
    </section>
  {:else}
    <section class="community-account-settings__section">
      <header><h2>Sign-in details</h2></header>
      <dl class="community-account-settings__rows">
        <div>
          <dt>Signed in with</dt>
          <dd>
            <strong>{providerLabel(account.auth_provider)}</strong>
            {#if authIdentity}
              <span>{authIdentity.display_name || authIdentity.login}</span>
            {/if}
          </dd>
        </div>
        <div>
          <dt>Linked identities</dt>
          <dd class="community-account-settings__identities">
            {#if account.identities.length === 0}
              <span>No provider identities linked</span>
            {:else}
              {#each account.identities as identity (`${identity.provider}:${identity.login}`)}
                <span>
                  <strong>{providerLabel(identity.provider)}</strong>
                  {identity.display_name || identity.login}
                  {#if identity.display_name && identity.login}
                    <small>@{identity.login}</small>
                  {/if}
                </span>
              {/each}
            {/if}
          </dd>
        </div>
        <div>
          <dt>Nostr public key</dt>
          <dd class="community-account-settings__pubkey">
            <code>{account.account.nostr_pubkey}</code>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={working}
              aria-label="Copy public key"
              onclick={() =>
                copyValue(
                  account.account.nostr_pubkey,
                  "Public key copied.",
                  copyPublicKeyAction,
                )}
            >
              <CopyIcon data-icon="inline-start" aria-hidden="true" />Copy
            </Button>
          </dd>
        </div>
      </dl>
    </section>

    <section class="community-account-settings__section">
      <header><h2>Security and connections</h2></header>
      <dl class="community-account-settings__rows">
        <div>
          <dt>Signer</dt>
          <dd>
            <span class="community-account-settings__value-line">
              <strong>{signer?.label}</strong>
              <CommunityChip
                size="compact"
                tone={signer?.state === "active"
                  ? "success"
                  : signer?.state === "pending"
                    ? "warning"
                    : "danger"}>{signer?.state}</CommunityChip
              >
            </span>
            <span>{signer?.description}</span>
            {#if account.signer_status === "migration_pending" && canTransferCustody}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={working}
                onclick={openTransfer}
              >
                <RefreshCwIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />Resume signing-key transfer
              </Button>
            {:else if account.signer_type === "managed" && canTransferCustody}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={working}
                onclick={openTransfer}
              >
                <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />Move
                signing to a remote signer
              </Button>
            {:else if account.signer_type === "nip46" && canManageRemoteSigner}
              <div class="community-account-settings__inline-actions">
                {#if actions?.switchRemoteSignerRelays}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={working}
                    onclick={checkRemoteSignerRelays}
                  >
                    <RefreshCwIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Check signer relays
                  </Button>
                {/if}
                {#if actions?.disconnectRemoteSigner}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={working}
                    onclick={() => (disconnectSignerOpen = true)}
                  >
                    <UnlinkIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Disconnect signer
                  </Button>
                {/if}
              </div>
            {:else if account.signer_type === "external"}
              <div class="community-account-settings__inline-actions">
                {#if actions?.reconnectSigner}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={working}
                    onclick={() =>
                      runAction(
                        "signer-reconnect",
                        actions?.reconnectSigner ?? (() => {}),
                      )}
                  >
                    <RefreshCwIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Reconnect signer
                  </Button>
                {/if}
                {#if canManageRemoteSigner && actions?.connectRemoteSigner}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={working}
                    onclick={openRemoteSigner}
                  >
                    <ShieldCheckIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />Use remote signer
                  </Button>
                {/if}
              </div>
            {/if}
          </dd>
        </div>
        <div>
          <dt>GitHub</dt>
          <dd>
            <span class="community-account-settings__value-line">
              <strong
                >{githubIdentity?.login
                  ? `@${githubIdentity.login}`
                  : "Not linked"}</strong
              >
              <CommunityChip
                size="compact"
                tone={account.github_status === "active"
                  ? "success"
                  : account.github_status === "unlinked"
                    ? "neutral"
                    : "warning"}
              >
                {githubStatusLabel(account.github_status)}
              </CommunityChip>
            </span>
            <div class="community-account-settings__inline-actions">
              {#if githubAction && connectGitHubAction}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={working}
                  onclick={connectGitHub}
                >
                  <GitBranchIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />{githubAction}
                </Button>
              {:else if account.github_status === "active" && canDisconnectGitHub}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={working}
                  onclick={() => (disconnectGitHubOpen = true)}
                >
                  <UnlinkIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />Disconnect GitHub access
                </Button>
              {/if}
            </div>
          </dd>
        </div>
        <div>
          <dt>Passkeys</dt>
          <dd>
            <span
              ><strong>{account.passkey_count}</strong
              >{account.passkey_count === 1 ? " passkey" : " passkeys"}</span
            >
            {#if account.passkey_count === 0 && canRegisterPasskey}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={working}
                onclick={registerPasskey}
              >
                <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />Add
                passkey
              </Button>
            {/if}
          </dd>
        </div>
        <div>
          <dt>Session expires</dt>
          <dd>
            <strong>{formatCommunityAccountExpiry(account.expires_at)}</strong>
          </dd>
        </div>
      </dl>
    </section>
  {/if}

  {#if signOutAction}
    <section class="community-account-settings__actions">
      <div>
        <h2>Sign out</h2>
        <p>End this relay session and disconnect the current signer.</p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={working}
        onclick={() => runAction("sign-out", signOutAction)}
      >
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />Sign out
      </Button>
    </section>
  {/if}

  {#if localError}
    <Alert.Root
      variant="destructive"
      class="community-account-settings__notice"
    >
      <CircleAlertIcon aria-hidden="true" />
      <Alert.Title>Account change failed</Alert.Title>
      <Alert.Description>{localError}</Alert.Description>
    </Alert.Root>
  {:else if localMessage || message}
    <p class="community-account-settings__message" role="status">
      {localMessage || message}
    </p>
  {/if}
</div>

<ConfirmDialog
  bind:open={disconnectGitHubOpen}
  title="Disconnect GitHub access?"
  description="Community will stop using the saved GitHub credential. Your linked GitHub identity remains on the account so attribution stays intact."
  confirmLabel="Disconnect access"
  destructive
  pending={working}
  onConfirm={disconnectGitHub}
/>

<ConfirmDialog
  bind:open={disconnectSignerOpen}
  title="Disconnect this remote signer?"
  description="The account remains available, but Community cannot sign events until you reconnect a signer for the same Nostr public key."
  confirmLabel="Disconnect signer"
  destructive
  pending={working}
  onConfirm={disconnectRemoteSigner}
/>

<Dialog.Root bind:open={remoteSignerOpen}>
  <DialogFrame
    title="Connect a remote signer"
    description="Use a NIP-46 bunker invitation for this account's existing Nostr key."
    size="form"
    busy={working}
  >
    <form
      id="community-account-remote-signer"
      class="community-account-settings__dialog-form"
      onsubmit={connectRemoteSigner}
    >
      <label for="community-account-bunker-url">Bunker URL</label>
      <Input
        id="community-account-bunker-url"
        type="password"
        autocomplete="off"
        autocapitalize="none"
        spellcheck={false}
        placeholder="bunker://…"
        disabled={working}
        bind:value={remoteSignerUrl}
      />
      <p>
        The relay validates that the signer controls this account's canonical
        Nostr public key.
      </p>
    </form>
    {#snippet footer()}
      <Button
        type="button"
        variant="outline"
        disabled={working}
        onclick={() => (remoteSignerOpen = false)}>Cancel</Button
      >
      <Button
        type="submit"
        form="community-account-remote-signer"
        disabled={working || remoteSignerUrl.trim() === ""}
      >
        {pendingAction === "remote-connect" ? "Connecting…" : "Connect signer"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>

<Dialog.Root open={transferOpen} onOpenChange={changeTransferOpen}>
  <DialogFrame
    title="Move signing to a remote signer"
    description="Transfer this account's Nostr key into a signer you control."
    size="form"
    busy={working}
  >
    {#if transferHandoff === undefined}
      <div class="community-account-settings__transfer-intro">
        <Alert.Root variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <Alert.Title>This reveals the account's private key</Alert.Title>
          <Alert.Description>
            After it is revealed, the relay marks migration as pending and will
            not resume managed signing. Import the key into a remote signer and
            finish the transfer, or restart this flow later.
          </Alert.Description>
        </Alert.Root>
        {#if account?.passkey_count === 0}
          <p>Add a passkey before the relay can release the signing key.</p>
        {:else}
          <p>
            Your passkey verifies that you approved this sensitive account
            change. The key is shown only in this browser flow.
          </p>
        {/if}
      </div>
    {:else}
      <form
        id="community-account-custody-transfer"
        class="community-account-settings__dialog-form"
        onsubmit={completeTransfer}
      >
        <Alert.Root variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <Alert.Title>Store this key now</Alert.Title>
          <Alert.Description
            >Community cannot recover it after this dialog closes. Do not share
            it or paste it anywhere except the signer you control.</Alert.Description
          >
        </Alert.Root>
        <label for="community-account-transferred-key">Nostr private key</label>
        <div class="community-account-settings__secret-field">
          <Input
            id="community-account-transferred-key"
            type={showTransferredNsec ? "text" : "password"}
            readonly
            autocomplete="off"
            value={transferredNsec}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={showTransferredNsec
              ? "Hide private key"
              : "Reveal private key"}
            onclick={() => (showTransferredNsec = !showTransferredNsec)}
          >
            {#if showTransferredNsec}<EyeOffIcon
                aria-hidden="true"
              />{:else}<EyeIcon aria-hidden="true" />{/if}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Copy private key"
            onclick={() => copyValue(transferredNsec, "Private key copied.")}
          >
            <CopyIcon aria-hidden="true" />
          </Button>
        </div>
        <label class="community-account-settings__check">
          <Checkbox
            checked={transferImported}
            onCheckedChange={(checked) => (transferImported = checked === true)}
            aria-label="I imported this key into my remote signer"
          />
          <span>I imported this key into my remote signer.</span>
        </label>
        <label for="community-account-transfer-bunker-url"
          >New signer bunker URL</label
        >
        <Input
          id="community-account-transfer-bunker-url"
          type="password"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          placeholder="bunker://…"
          disabled={working}
          bind:value={transferBunkerUrl}
        />
        <p>
          The signer must prove possession of this exact key before the relay
          completes the migration.
        </p>
      </form>
    {/if}

    {#snippet footer()}
      {#if transferHandoff === undefined}
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onclick={() => changeTransferOpen(false)}>Cancel</Button
        >
        {#if account?.passkey_count === 0 && canRegisterPasskey}
          <Button type="button" disabled={working} onclick={registerPasskey}
            >Add passkey</Button
          >
        {:else}
          <Button
            type="button"
            disabled={working || account?.passkey_count === 0}
            onclick={beginTransfer}
          >
            {pendingAction === "custody-begin"
              ? "Verifying…"
              : account?.signer_status === "migration_pending"
                ? "Restart transfer"
                : "Verify and reveal key"}
          </Button>
        {/if}
      {:else}
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onclick={beginTransfer}>Restart</Button
        >
        <Button
          type="submit"
          form="community-account-custody-transfer"
          disabled={working ||
            !transferImported ||
            transferBunkerUrl.trim() === ""}
        >
          {pendingAction === "custody-complete"
            ? "Completing…"
            : "Complete transfer"}
        </Button>
      {/if}
    {/snippet}
  </DialogFrame>
</Dialog.Root>
