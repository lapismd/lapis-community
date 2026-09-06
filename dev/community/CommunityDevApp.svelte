<script lang="ts">
  import {
    SecretKeyRegistrySigner,
    Nip07RegistrySigner,
  } from "../../src/auth/index.js";
  import {
    createBrowserCommunityConfigurationStore,
    createBrowserCommunityEventRuntime,
    createCommunityController,
    createNip07CommunityIdentityConnector,
    createNip29CommunitySource,
    type CommunityController,
    type CommunityIdentity,
    type CommunityScope,
  } from "../../src/community/index.js";
  import { CommunityApplication } from "../../src/components/index.js";
  import type { CommunityLoginCredentials } from "../../src/components/community-login/model.js";
  import {
    COMMUNITY_LOGIN_METHODS,
    type CommunityLoginMethodModel,
  } from "../../src/components/community-login/model.js";
  import { createNip29RegistryCatalogDataSource } from "../../src/registry/index.js";
  import { createWebSocketCommunityRelayFactory } from "../../src/nostr/index.js";
  import { LAPIS_GROUPS, lapisGroupId } from "../../src/protocol/index.js";
  import { hexToBytes } from "@noble/hashes/utils.js";
  import { BunkerSigner, parseBunkerInput } from "nostr-tools/nip46";
  import { nip19 } from "nostr-tools";
  import { generateSecretKey } from "nostr-tools/pure";
  import { onMount } from "svelte";

  const relayUrl =
    import.meta.env.VITE_COMMUNITY_LIVE_RELAY_URL?.trim() ||
    "ws://registry.localhost:8281";
  const values = (value: string | undefined): string[] =>
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const registryRelays = values(import.meta.env.VITE_REGISTRY_RELAYS);
  const registryCurators = new Set(
    values(import.meta.env.VITE_REGISTRY_CURATOR_PUBKEYS),
  );
  const registryPublishers = new Set(
    values(import.meta.env.VITE_REGISTRY_PUBLISHER_PUBKEYS),
  );
  const registryAuthorityEpoch =
    import.meta.env.VITE_REGISTRY_AUTHORITY_EPOCH?.trim() || undefined;
  const registryConfigurationError =
    registryRelays.length === 0 ||
    registryCurators.size === 0 ||
    registryPublishers.size === 0
      ? "Run pnpm local:up before dev:community so the live registry trust configuration is available"
      : "";
  const registrySource =
    registryConfigurationError === ""
      ? createNip29RegistryCatalogDataSource({
          relays: registryRelays,
          authorities: {
            curatorPubkeys: registryCurators,
            publisherPubkeysByPlugin: new Map(),
            defaultPublisherPubkeys: registryPublishers,
            ...(registryAuthorityEpoch === undefined
              ? {}
              : { authorityEpoch: registryAuthorityEpoch }),
          },
          relayFactory: createWebSocketCommunityRelayFactory(),
        })
      : undefined;
  const loginMethods: readonly CommunityLoginMethodModel[] = [
    COMMUNITY_LOGIN_METHODS.browserExtension,
    COMMUNITY_LOGIN_METHODS.remoteSigner,
    {
      ...COMMUNITY_LOGIN_METHODS.createAccount,
      label: "Create an ephemeral account",
      description: "Generate an in-memory identity that is discarded on reload",
    },
    COMMUNITY_LOGIN_METHODS.privateKey,
  ];

  let controller = $state.raw<CommunityController>();
  let runtimeError = $state("");
  let remoteSignerUrl = $state("");
  let activeBunker = $state.raw<BunkerSigner>();
  let activeIdentity = $state.raw<CommunityIdentity>();

  $effect(() => {
    if (controller?.state.authentication.status === "anonymous") {
      activeIdentity = undefined;
    }
  });

  onMount(() => {
    const relayFactory = createWebSocketCommunityRelayFactory();
    const scope: CommunityScope = {
      id: "registry",
      name: "Registry",
      relayUrl,
      discoverPublicRooms: true,
      rooms: [
        {
          id: "general",
          groupId: lapisGroupId(LAPIS_GROUPS.general),
          name: "general",
          kind: "channel",
        },
        {
          id: "plugin-releases",
          groupId: lapisGroupId(LAPIS_GROUPS.pluginReleases),
          name: "plugin-releases",
          kind: "channel",
        },
        {
          id: "plugin-development",
          groupId: lapisGroupId(LAPIS_GROUPS.pluginDevelopment),
          name: "plugin-development",
          kind: "channel",
        },
        {
          id: "forums",
          groupId: lapisGroupId(LAPIS_GROUPS.forums),
          name: "forums",
          kind: "forum",
        },
      ],
    };

    try {
      controller = createCommunityController({
        scopes: [scope],
        source: createNip29CommunitySource({ relayFactory }),
        identityConnector: createNip07CommunityIdentityConnector(),
        configurationStore: createBrowserCommunityConfigurationStore({
          prefix: "lapismd.community.dev.v1",
        }),
        runtime: createBrowserCommunityEventRuntime(),
        now: () => Math.floor(Date.now() / 1_000),
      });
      controller.initialize();
    } catch (cause) {
      runtimeError =
        cause instanceof Error ? cause.message : "Community failed to start";
    }

    return () => {
      controller?.dispose();
      registrySource?.dispose();
      void activeBunker?.close();
    };
  });

  function secretKey(value: string): Uint8Array {
    const normalized = value.trim();
    if (/^[0-9a-f]{64}$/iu.test(normalized)) return hexToBytes(normalized);
    if (normalized.startsWith("nsec1")) {
      const decoded = nip19.decode(normalized);
      if (decoded.type === "nsec" && decoded.data instanceof Uint8Array) {
        return decoded.data;
      }
    }
    throw new Error("Use an nsec or a 64-character hexadecimal private key");
  }

  async function remoteIdentity(): Promise<CommunityIdentity> {
    const input = remoteSignerUrl.trim();
    if (input === "") {
      throw new Error(
        "Enter a bunker URL in the development controls before using Remote signer",
      );
    }
    const pointer = await parseBunkerInput(input);
    if (pointer === null) throw new Error("The remote signer URL is invalid");
    await activeBunker?.close();
    const bunker = BunkerSigner.fromBunker(generateSecretKey(), pointer, {
      onauth: (url) => void window.open(url, "_blank", "noopener,noreferrer"),
    });
    await bunker.connect({ name: "Lapis Community Dev", url: location.origin });
    activeBunker = bunker;
    return {
      getPublicKey: () => bunker.getPublicKey(),
      signEvent: (template) => bunker.signEvent(template),
      nip44: {
        encrypt: (pubkey, plaintext) => bunker.nip44Encrypt(pubkey, plaintext),
        decrypt: (pubkey, ciphertext) =>
          bunker.nip44Decrypt(pubkey, ciphertext),
      },
    };
  }

  async function connectIdentity(
    methodId: string,
    credentials?: CommunityLoginCredentials,
  ): Promise<CommunityIdentity> {
    let identity: CommunityIdentity;
    if (methodId === COMMUNITY_LOGIN_METHODS.browserExtension.id) {
      const identity = new Nip07RegistrySigner();
      await identity.getPublicKey();
      activeIdentity = identity;
      return identity;
    } else if (methodId === COMMUNITY_LOGIN_METHODS.remoteSigner.id) {
      identity = await remoteIdentity();
    } else if (methodId === COMMUNITY_LOGIN_METHODS.createAccount.id) {
      identity = new SecretKeyRegistrySigner(generateSecretKey());
    } else if (methodId === COMMUNITY_LOGIN_METHODS.privateKey.id) {
      if (credentials === undefined) throw new Error("Private key is required");
      identity = new SecretKeyRegistrySigner(secretKey(credentials.privateKey));
    } else {
      throw new Error(`Unknown login method: ${methodId}`);
    }
    activeIdentity = identity;
    return identity;
  }
</script>

<div class="community-dev">
  <details class="community-dev__controls">
    <summary>Development controls</summary>
    <div class="community-dev__controls-body">
      <span><strong>Relay</strong> {relayUrl}</span>
      <label>
        <span>Remote signer bunker URL</span>
        <input
          type="password"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          placeholder="bunker://… or name@example.com"
          bind:value={remoteSignerUrl}
        />
      </label>
      <span>The value stays in memory and is never logged or persisted.</span>
    </div>
  </details>

  <main class="community-dev__app">
    {#if runtimeError}
      <div class="community-dev__error" role="alert">{runtimeError}</div>
    {:else if controller}
      {#if registrySource}
        <CommunityApplication
          {controller}
          initialDestination="general"
          registryOptions={{
            source: registrySource,
            ...(activeIdentity === undefined
              ? {}
              : { discussionIdentity: activeIdentity }),
          }}
          loginOptions={{
            methods: loginMethods,
            allowLocalKeyMethods: true,
            connect: connectIdentity,
            title: "Sign in to the live community",
            description: "Choose a development identity provider",
          }}
        />
      {:else}
        <div class="community-dev__error" role="alert">
          {registryConfigurationError}
        </div>
      {/if}
    {:else}
      <p class="community-dev__loading" role="status">
        Connecting to {relayUrl}…
      </p>
    {/if}
  </main>
</div>

<style>
  .community-dev {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .community-dev__controls {
    position: relative;
    z-index: 50;
    border-bottom: 1px solid var(--border);
    background: var(--background);
    color: var(--foreground);
    font-size: 0.75rem;
  }

  .community-dev__controls summary {
    width: fit-content;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    font-weight: 600;
  }

  .community-dev__controls-body {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: end;
    padding: 0.5rem 0.75rem 0.75rem;
    border-top: 1px solid var(--border);
    color: var(--muted-foreground);
  }

  .community-dev__controls-body label {
    display: grid;
    gap: 0.25rem;
    min-width: min(28rem, 100%);
  }

  .community-dev__controls-body input {
    min-height: 2rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--input);
    border-radius: var(--radius);
    outline: none;
    color: var(--foreground);
    background: var(--background);
  }

  .community-dev__controls-body input:focus-visible {
    border-color: var(--ring);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 30%, transparent);
  }

  .community-dev__app {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .community-dev__error,
  .community-dev__loading {
    margin: 1rem;
    padding: 1rem;
  }

  .community-dev__error {
    border: 1px solid var(--destructive);
    border-radius: var(--radius);
    color: var(--destructive);
  }
</style>
