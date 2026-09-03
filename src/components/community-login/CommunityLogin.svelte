<script lang="ts">
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Card from "@lapismd/design-core/shadcn/card";
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
    onSelect?: (methodId: string) => void | Promise<void>;
  } = $props();

  function methodIcon(kind: CommunityLoginMethodKind): Component {
    if (kind === "browser-extension") return LockKeyholeIcon;
    if (kind === "remote-signer") return ShieldCheckIcon;
    if (kind === "create-account") return SparklesIcon;
    if (kind === "private-key") return KeyRoundIcon;
    return UserRoundIcon;
  }
</script>

<main
  class={["community-login", className].filter(Boolean).join(" ")}
  aria-label="Nostr sign in"
  aria-busy={busy}
  data-status={error ? "error" : busy ? "connecting" : "anonymous"}
  {...restProps}
>
  <Card.Root class="community-login__card">
    <Card.Header>
      <Card.Title><h1 class="community-login__title">{title}</h1></Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card.Header>

    <Card.Content>
      {#if error}
        <Alert.Root variant="destructive" class="community-login__error">
          <CircleAlertIcon aria-hidden="true" />
          <Alert.Title>Sign in failed</Alert.Title>
          <Alert.Description>{error}</Alert.Description>
        </Alert.Root>
      {/if}

      {#if methods.length > 0}
        <div class="community-login__methods">
          {#each methods as method (method.id)}
            {@const MethodIcon = methodIcon(method.kind)}
            {@const pending = busy && pendingMethodId === method.id}
            <Button
              type="button"
              variant="outline"
              class="community-login__method"
              disabled={busy || method.disabled}
              onclick={() => void onSelect(method.id)}
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
</main>

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

  :global(.community-login__card[data-ui-component="card"]) {
    width: min(100%, 28rem);
  }

  .community-login__methods,
  .community-login__method-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .community-login__methods {
    gap: 0.625rem;
  }

  :global(.community-login__error[data-ui-component="alert"]) {
    margin-block-end: 1rem;
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
