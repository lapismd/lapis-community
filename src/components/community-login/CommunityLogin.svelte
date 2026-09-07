<script lang="ts">
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Card from "@lapismd/design-core/shadcn/card";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Spinner } from "@lapismd/design-core/shadcn/spinner";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import LockKeyholeIcon from "@lucide/svelte/icons/lock-keyhole";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import UserRoundIcon from "@lucide/svelte/icons/user-round";
  import type { Component } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import {
    DEFAULT_COMMUNITY_LOGIN_METHODS,
    type CommunityLoginCredentials,
    type CommunityLoginMethodKind,
    type CommunityLoginMethodModel,
  } from "./model.js";

  let {
    methods = DEFAULT_COMMUNITY_LOGIN_METHODS,
    title = "Connect to Nostr",
    description = "Choose your login method",
    footnote = "Your identity stays under your control. Lapis only requests signatures for actions you approve.",
    busy = false,
    pendingMethodId = "",
    error = "",
    presentation = "page",
    onSelect = () => {},
    class: className,
    ...restProps
  }: HTMLAttributes<HTMLElement> & {
    methods?: readonly CommunityLoginMethodModel[];
    title?: string;
    description?: string;
    footnote?: string;
    busy?: boolean;
    pendingMethodId?: string;
    error?: string;
    presentation?: "page" | "dialog";
    onSelect?: (
      methodId: string,
      credentials?: CommunityLoginCredentials,
    ) => void | Promise<void>;
  } = $props();

  let privateKeyMethod = $state<CommunityLoginMethodModel>();
  let privateKey = $state("");
  let remoteSignerMethod = $state<CommunityLoginMethodModel>();
  let remoteSignerUrl = $state("");
  let validationError = $state("");
  const displayedError = $derived(validationError || error);

  function selectMethod(method: CommunityLoginMethodModel): void {
    validationError = "";
    if (method.kind === "remote-signer") {
      remoteSignerMethod = method;
      return;
    }
    if (method.kind === "private-key") {
      privateKeyMethod = method;
      return;
    }
    void Promise.resolve(onSelect(method.id)).catch(() => undefined);
  }

  function closePrivateKeyForm(): void {
    privateKey = "";
    validationError = "";
    privateKeyMethod = undefined;
  }

  function closeRemoteSignerForm(): void {
    remoteSignerUrl = "";
    validationError = "";
    remoteSignerMethod = undefined;
  }

  async function submitRemoteSigner(): Promise<void> {
    const value = remoteSignerUrl.trim();
    if (value === "") {
      validationError = "Paste a bunker URL before signing in";
      return;
    }
    if (remoteSignerMethod === undefined) return;
    validationError = "";
    try {
      await onSelect(remoteSignerMethod.id, { remoteSignerUrl: value });
      closeRemoteSignerForm();
    } catch {
      // The host owns the displayed error. Keep the credential form available
      // so the user can correct it without pasting the value again.
    }
  }

  async function submitPrivateKey(): Promise<void> {
    const value = privateKey.trim();
    if (value === "") {
      validationError = "Paste a private key before signing in";
      return;
    }
    if (privateKeyMethod === undefined) return;
    validationError = "";
    try {
      await onSelect(privateKeyMethod.id, { privateKey: value });
      closePrivateKeyForm();
    } catch {
      // The host owns the displayed error. Keep this in component state only
      // for an in-dialog retry and clear it when the form closes.
    }
  }

  function methodIcon(kind: CommunityLoginMethodKind): Component {
    if (kind === "browser-extension") return LockKeyholeIcon;
    if (kind === "remote-signer") return ShieldCheckIcon;
    if (kind === "create-account") return SparklesIcon;
    if (kind === "private-key") return KeyRoundIcon;
    return UserRoundIcon;
  }
</script>

<svelte:element
  this={presentation === "dialog" ? "section" : "main"}
  class={["community-login", className].filter(Boolean).join(" ")}
  aria-label="Nostr sign in"
  aria-busy={busy}
  data-status={displayedError ? "error" : busy ? "connecting" : "anonymous"}
  data-presentation={presentation}
  {...restProps}
>
  <Card.Root class="community-login__card">
    <Card.Header>
      <Card.Title>
        {#if presentation === "dialog"}
          <span class="community-login__title">{title}</span>
        {:else}
          <h1 class="community-login__title">{title}</h1>
        {/if}
      </Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card.Header>

    <Card.Content>
      {#if displayedError}
        <Alert.Root variant="destructive" class="community-login__error">
          <CircleAlertIcon aria-hidden="true" />
          <Alert.Title>Sign in failed</Alert.Title>
          <Alert.Description>{displayedError}</Alert.Description>
        </Alert.Root>
      {/if}

      {#if remoteSignerMethod !== undefined}
        <form
          class="community-login__credential-form"
          onsubmit={(event) => {
            event.preventDefault();
            void submitRemoteSigner();
          }}
        >
          <div class="community-login__credential-copy">
            <strong>{remoteSignerMethod.label}</strong>
            <span>{remoteSignerMethod.description}</span>
          </div>
          <label for="community-login-remote-signer">Bunker URL</label>
          <Input
            id="community-login-remote-signer"
            name="nostr-bunker-url"
            type="password"
            autocomplete="off"
            autocapitalize="none"
            spellcheck={false}
            placeholder="bunker://…"
            aria-describedby="community-login-remote-signer-help"
            disabled={busy}
            bind:value={remoteSignerUrl}
          />
          <p id="community-login-remote-signer-help">
            The connection invitation is passed once to the host and stored in
            its secure credential store, never in plugin settings.
          </p>
          <div class="community-login__credential-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onclick={closeRemoteSignerForm}>Back</Button
            >
            <Button type="submit" disabled={busy}>
              {busy ? "Connecting…" : "Connect remote signer"}
            </Button>
          </div>
        </form>
      {:else if privateKeyMethod !== undefined}
        <form
          class="community-login__credential-form"
          onsubmit={(event) => {
            event.preventDefault();
            void submitPrivateKey();
          }}
        >
          <div class="community-login__credential-copy">
            <strong>{privateKeyMethod.label}</strong>
            <span>{privateKeyMethod.description}</span>
          </div>
          <label for="community-login-private-key">Private key</label>
          <Input
            id="community-login-private-key"
            name="nostr-private-key"
            type="password"
            autocomplete="off"
            autocapitalize="none"
            spellcheck={false}
            placeholder="nsec1… or 64-character hex"
            aria-describedby="community-login-private-key-help"
            disabled={busy}
            bind:value={privateKey}
          />
          <p id="community-login-private-key-help">
            The key is passed once to the configured identity provider and is
            not saved by this component.
          </p>
          <div class="community-login__credential-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onclick={closePrivateKeyForm}>Back</Button
            >
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in with private key"}
            </Button>
          </div>
        </form>
      {:else if methods.length > 0}
        <div class="community-login__methods">
          {#each methods as method (method.id)}
            {@const MethodIcon = methodIcon(method.kind)}
            {@const pending = busy && pendingMethodId === method.id}
            <Button
              type="button"
              variant="outline"
              class="community-login__method"
              disabled={busy || method.disabled}
              onclick={() => selectMethod(method)}
            >
              {#if pending}
                <span
                  class="community-login__method-icon"
                  role="status"
                  aria-label={`Connecting with ${method.label}`}
                >
                  <Spinner aria-hidden="true" />
                </span>
              {:else}
                <span class="community-login__method-icon" aria-hidden="true">
                  <MethodIcon />
                </span>
              {/if}
              <span class="community-login__method-copy">
                <strong>{pending ? "Connecting…" : method.label}</strong>
                <span>{method.description}</span>
              </span>
            </Button>
          {/each}
        </div>
      {:else}
        <Alert.Root>
          <CircleAlertIcon aria-hidden="true" />
          <Alert.Title>No login methods available</Alert.Title>
          <Alert.Description>
            Ask the application host to configure a Nostr identity provider.
          </Alert.Description>
        </Alert.Root>
      {/if}
    </Card.Content>

    {#if footnote}
      <Card.Footer>
        <p class="community-login__footnote">{footnote}</p>
      </Card.Footer>
    {/if}
  </Card.Root>
</svelte:element>

<style>
  .community-login {
    display: grid;
    width: 100%;
    min-height: 100%;
    padding: clamp(1rem, 5vw, 3rem);
    place-items: center;
    color: var(--foreground);
    background-color: var(--background);
    background-image: linear-gradient(
        color-mix(in srgb, var(--border) 35%, transparent) 1px,
        transparent 1px
      ),
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--border) 35%, transparent) 1px,
        transparent 1px
      );
    background-size: 4rem 4rem;
  }

  .community-login[data-presentation="dialog"] {
    display: block;
    min-height: 0;
    padding: 0;
    background: transparent;
  }

  :global(.community-login__card[data-ui-component="card"]) {
    width: min(100%, 28rem);
  }

  :global(
      .community-login[data-presentation="dialog"]
        .community-login__card[data-ui-component="card"]
    ) {
    width: 100%;
    --card-spacing: 1rem;
    background: transparent;
    box-shadow: none;
  }

  .community-login__methods,
  .community-login__method-copy,
  .community-login__credential-form,
  .community-login__credential-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .community-login__methods {
    gap: 0.625rem;
  }

  .community-login__credential-form {
    gap: 0.75rem;
  }

  .community-login__credential-copy {
    gap: 0.125rem;
  }

  .community-login__credential-copy > span,
  .community-login__credential-form > p {
    color: var(--muted-foreground);
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .community-login__credential-form > label {
    margin-bottom: -0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .community-login__credential-form > p {
    margin: 0;
  }

  .community-login__credential-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  :global(.community-login__error[data-ui-component="alert"]) {
    margin-block-end: 1rem;
    color: color-mix(in srgb, var(--destructive) 78%, var(--foreground));
  }

  :global(
      .community-login__error[data-ui-component="alert"]
        [data-ui-part="alert-description"]
    ) {
    color: color-mix(in srgb, var(--destructive) 72%, var(--foreground));
  }

  :global(.community-login__method[data-ui-component="button"]) {
    width: 100%;
    height: auto;
    min-height: 4.5rem;
    justify-content: flex-start;
    gap: 0.875rem;
    padding: 0.75rem;
    text-align: start;
    white-space: normal;
  }

  .community-login__method-icon {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    flex: none;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--accent-foreground);
    background: var(--accent);
  }

  .community-login__method-icon :global(svg) {
    width: 1.125rem;
    height: 1.125rem;
  }

  .community-login__method-copy {
    gap: 0.125rem;
  }

  .community-login__method-copy strong {
    color: var(--foreground);
  }

  .community-login__title {
    margin: 0;
    font: inherit;
  }

  .community-login__method-copy > span,
  .community-login__footnote {
    color: var(--muted-foreground);
  }

  .community-login__method-copy > span {
    font-size: 0.75rem;
    line-height: 1.35;
  }

  .community-login__footnote {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.45;
  }

  @media (max-width: 32rem) {
    .community-login {
      padding: 0.75rem;
      background-size: 3rem 3rem;
    }
  }
</style>
