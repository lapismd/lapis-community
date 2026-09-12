<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import LogOutIcon from "@lucide/svelte/icons/log-out";

  import type { CommunityAccountSession } from "../../auth/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import {
    communityAccountSignerDetails,
    communityGitHubActionLabel,
    formatCommunityAccountExpiry,
  } from "./model.js";
  import "./CommunityAccountSettings.css";

  let {
    account,
    busy = false,
    message = "",
    onCopyPublicKey,
    onConnectGitHub,
    onSignOut,
  }: {
    account?: CommunityAccountSession | undefined;
    busy?: boolean;
    message?: string;
    onCopyPublicKey?: ((pubkey: string) => void | Promise<void>) | undefined;
    onConnectGitHub?: (() => void | Promise<void>) | undefined;
    onSignOut?: (() => void | Promise<void>) | undefined;
  } = $props();

  const signer = $derived(
    account === undefined ? undefined : communityAccountSignerDetails(account),
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

  function providerLabel(value: string): string {
    if (value === "github") return "GitHub";
    if (value === "google") return "Google";
    if (value === "nostr") return "Nostr signer";
    return value;
  }

  function githubStatusLabel(value: string): string {
    return value.replaceAll("_", " ");
  }
</script>

<div
  class="community-account-settings"
  data-ui-component="community-account-settings"
  aria-labelledby="community-account-title"
>
  <header class="community-account-settings__heading">
    <h1 id="community-account-title">Account</h1>
    <p>Review how this Community account signs in and signs Nostr events.</p>
  </header>

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
            {#if onCopyPublicKey}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Copy public key"
                onclick={() => onCopyPublicKey(account.account.nostr_pubkey)}
              >
                <CopyIcon data-icon="inline-start" aria-hidden="true" />Copy
              </Button>
            {/if}
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
                >{githubStatusLabel(account.github_status)}</CommunityChip
              >
            </span>
            {#if githubAction && onConnectGitHub}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onclick={onConnectGitHub}
              >
                <GitBranchIcon data-icon="inline-start" aria-hidden="true" />
                {githubAction}
              </Button>
            {/if}
          </dd>
        </div>
        <div>
          <dt>Passkeys</dt>
          <dd><strong>{account.passkey_count}</strong></dd>
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

  {#if onSignOut}
    <section class="community-account-settings__actions">
      <div>
        <h2>Sign out</h2>
        <p>End this relay session and disconnect the current signer.</p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onclick={onSignOut}
      >
        <LogOutIcon data-icon="inline-start" aria-hidden="true" />Sign out
      </Button>
    </section>
  {/if}

  {#if message}<p class="community-account-settings__message" role="status">
      {message}
    </p>{/if}
</div>
