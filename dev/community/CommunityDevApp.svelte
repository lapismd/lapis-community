<script lang="ts">
  import {
    createCommunityKeytrLoginIntegration,
    RelayAuthClient,
    type CommunityKeytrGateway,
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
  import {
    COMMUNITY_LOGIN_METHODS,
    type CommunityLoginMethodModel,
  } from "../../src/components/community-login/model.js";
  import { createNip29RegistryCatalogDataSource } from "../../src/registry/index.js";
  import { createNip34ProjectForgeDataSource } from "../../src/projects/index.js";
  import { resolveCommunityDevRelayConfiguration } from "./config.js";
  import { createWebSocketCommunityRelayFactory } from "../../src/nostr/index.js";
  import { LAPIS_GROUPS, lapisGroupId } from "../../src/protocol/index.js";
  import { onMount } from "svelte";
  import { createCommunityDevIdentityConnector } from "./community-dev-identity.js";
  import CommunityDevPrivateKeyToast from "./CommunityDevPrivateKeyToast.svelte";
  import { communityKeytrLibrary } from "./keytr-adapter.js";
  import {
    attachCommunityDevPrivateKeyAuthRestore,
    restoreCommunityDevPrivateKeyIdentity,
  } from "./private-key-session.js";

  const { relayUrl, registryRelays, authUrl } =
    resolveCommunityDevRelayConfiguration(import.meta.env);
  const values = (value: string | undefined): string[] =>
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const registryCurators = new Set(
    values(import.meta.env.VITE_REGISTRY_CURATOR_PUBKEYS),
  );
  const registryPublishers = new Set(
    values(import.meta.env.VITE_REGISTRY_PUBLISHER_PUBKEYS),
  );
  const registryAuthorityEpoch =
    import.meta.env.VITE_REGISTRY_AUTHORITY_EPOCH?.trim() || undefined;
  const keytrRelayUrls = values(import.meta.env.VITE_COMMUNITY_KEYTR_RELAYS);
  const keytrGatewayValues = values(
    import.meta.env.VITE_COMMUNITY_KEYTR_GATEWAYS,
  );
  const keytrGateways: readonly CommunityKeytrGateway[] | undefined =
    keytrGatewayValues.length === 0
      ? undefined
      : keytrGatewayValues.map((entry) => {
          const separator = entry.indexOf("=");
          const rpId = (
            separator < 0 ? entry : entry.slice(0, separator)
          ).trim();
          const label =
            (separator < 0 ? entry : entry.slice(separator + 1)).trim() || rpId;
          return { id: rpId, label, rpId };
        });
  const keytrIntegration =
    keytrRelayUrls.length === 0
      ? undefined
      : createCommunityKeytrLoginIntegration({
          library: communityKeytrLibrary,
          relayUrls: keytrRelayUrls,
          ...(keytrGateways === undefined ? {} : { gateways: keytrGateways }),
          allowLocalKeyMethods: true,
          clientName: "Lapis Community",
        });
  const identityHost = createCommunityDevIdentityConnector({
    ...(keytrIntegration === undefined ? {} : { keytrIntegration }),
  });
  const relayFactory = createWebSocketCommunityRelayFactory();
  const registryConfigurationError =
    registryCurators.size === 0 || registryPublishers.size === 0
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
          relayFactory,
        })
      : undefined;
  const projectSource = createNip34ProjectForgeDataSource({ relayFactory });
  const loginMethods: readonly CommunityLoginMethodModel[] = [
    ...(keytrIntegration === undefined ? [] : [keytrIntegration.method]),
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
  let activeIdentity = $state.raw<CommunityIdentity>();
  let privateKeyRestoreStarted = false;
  const relayAuth =
    authUrl === undefined
      ? undefined
      : new RelayAuthClient({
          relayUrl: authUrl,
          connectIdentity: identityHost.connect,
        });
  if (relayAuth) attachCommunityDevPrivateKeyAuthRestore(relayAuth);

  $effect(() => {
    if (controller?.state.authentication.status === "anonymous") {
      activeIdentity = undefined;
    }
  });

  $effect(() => {
    const current = controller;
    if (!current || relayAuth || privateKeyRestoreStarted) return;
    privateKeyRestoreStarted = true;
    void restoreCommunityDevPrivateKeyIdentity(
      current,
      identityHost.connect,
    ).then((identity) => {
      if (identity) activeIdentity = identity;
    });
  });

  onMount(() => {
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
      void identityHost.dispose();
    };
  });

  async function connectIdentity(
    methodId: string,
    credentials?: Parameters<typeof identityHost.connect>[1],
    context?: Parameters<typeof identityHost.connect>[2],
  ): Promise<CommunityIdentity> {
    const identity = await identityHost.connect(methodId, credentials, context);
    activeIdentity = identity;
    return identity;
  }

  async function forgetPersistedPrivateKey(): Promise<void> {
    activeIdentity = undefined;
    await controller?.actions.disconnectIdentity();
    await relayAuth?.signOut().catch(() => undefined);
  }
</script>

<div class="community-dev">
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
          projectsOptions={{ source: projectSource }}
          loginOptions={{
            methods: loginMethods,
            allowLocalKeyMethods: true,
            connect: connectIdentity,
            ...(relayAuth === undefined ? {} : { auth: relayAuth }),
            title: "Sign in to the live community",
            description: "Choose a development identity provider",
          }}
        />
        <CommunityDevPrivateKeyToast onForget={forgetPersistedPrivateKey} />
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
    grid-template-rows: minmax(0, 1fr);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
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
