<script lang="ts">
  import { AppShellController } from "@lapismd/design-core/shell";
  import { onMount, tick } from "svelte";

  import {
    buildCommunityGroupInvite,
    createBrowserCommunityConfigurationStore,
    createBrowserCommunityEventRuntime,
    createInlineCommunityEventRuntime,
    createCommunityController,
    createNip29CommunitySource,
    type CommunityDataSource,
    type CommunityIdentity,
    type CommunityController,
  } from "../../community/index.js";
  import type { RegistryInstallRequest } from "../../registry/index.js";
  import {
    createNip34ProjectForgeDataSource,
    type ProjectForgeDataSource,
  } from "../../projects/index.js";
  import {
    createNip29ReleaseMessageTemplate,
    LAPIS_GROUPS,
    lapisGroupId,
  } from "../../protocol/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import type { CommunityLoginCredentials } from "../community-login/model.js";
  import {
    RelayAuthClient,
    type CommunityAccountSession,
  } from "../../auth/index.js";
  import RegistryCommunityStoryHarness from "../registry-community/RegistryCommunityStoryHarness.svelte";
  import { createRegistryStoryDataSource } from "../registry-browser/story-fixtures.js";
  import {
    createProjectStoryDataSource,
    seedProjectStoryRelay,
  } from "../community-projects/story-fixtures.js";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import { navigationSectionStorageKey } from "./navigation-sections.js";
  import type { CommunityApplicationAuthAdapter } from "./model.js";
  import {
    COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
    COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
    type CommunityApplicationDestination,
  } from "./navigation.js";

  let {
    signedIn = true,
    responsive = false,
    loginIdentity = "operator",
    namespace,
    releaseMessages = false,
    pulseFixtures = false,
    useDefaultShell = false,
    persistenceScenario = false,
    initialDestination = "registry",
    bootstrapDelayMs = 0,
    bootstrapFailure = false,
    progressiveDelayMs = 0,
    progressiveFailure = false,
    projects = false,
    emptyProjects = false,
    projectBackend = "walgit",
    relayAuthMode,
    relayAuthIdentityDelayMs = 0,
    relayAuthSignOutDelayMs = 0,
    onPresentationRead,
    onNavigationAction,
  }: {
    signedIn?: boolean;
    responsive?: boolean;
    loginIdentity?: "operator" | "participant";
    namespace?: string;
    releaseMessages?: boolean;
    pulseFixtures?: boolean;
    useDefaultShell?: boolean;
    persistenceScenario?: boolean;
    initialDestination?: CommunityApplicationDestination;
    bootstrapDelayMs?: number;
    bootstrapFailure?: boolean;
    progressiveDelayMs?: number;
    progressiveFailure?: boolean;
    projects?: boolean;
    emptyProjects?: boolean;
    projectBackend?: "github" | "walgit";
    relayAuthMode?: "managed" | "external" | "external-github" | "expiring";
    relayAuthIdentityDelayMs?: number;
    relayAuthSignOutDelayMs?: number;
    onPresentationRead?: (
      field: "timelinePresentation" | "inboxPresentation",
    ) => void;
    onNavigationAction?: (action: string) => void;
  } = $props();

  let runtime = $state.raw<CommunityStoryRuntime>();
  let community = $state.raw<CommunityController>();
  const observedCommunity = $derived.by(() => {
    const controller = community;
    const observe = onPresentationRead;
    const observeAction = onNavigationAction;
    if (!controller || (!observe && !observeAction)) return controller;
    return new Proxy(controller, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (property === "actions" && observeAction)
          return new Proxy(value, {
            get(actions, key, actionsReceiver) {
              const action = Reflect.get(actions, key, actionsReceiver);
              if (
                typeof key !== "string" ||
                !["selectRoom", "selectInboxItem", "closeSidePanel"].includes(
                  key,
                ) ||
                typeof action !== "function"
              )
                return action;
              return (...args: unknown[]) => {
                observeAction(key);
                return Reflect.apply(action, actions, args);
              };
            },
          });
        if (property !== "state" || !observe) return value;
        return new Proxy(value, {
          get(state, key, stateReceiver) {
            if (key === "timelinePresentation" || key === "inboxPresentation")
              observe(key);
            return Reflect.get(state, key, stateReceiver);
          },
        });
      },
    });
  });
  let runtimeError = $state("");
  let registrySource = $state.raw(createRegistryStoryDataSource());
  let projectSessionOpenCount = $state(0);
  let projectWorkItemReadCount = $state(0);
  let projectWorkItemSubscribeCount = $state(0);
  let projectSource = $state.raw<ProjectForgeDataSource>(
    observeProjectSource(createProjectStoryDataSource()),
  );
  let applicationGeneration = $state(0);
  let storyInviteUri = $state("");
  let relayAuthPubkey = $state("");
  let relayAuthSignOutCount = $state(0);
  let relayAuthSignOutControllerStatus = $state("");
  let relayAuthGitHubConnectCount = $state(0);
  let installedPluginIds = $state<string[]>([]);
  let progressiveRetryTimer: number | undefined;
  const storyShellController = new AppShellController({ rightClosed: true });
  const storyActiveMembership = $derived.by(() => {
    const workspace = community?.state.workspace;
    if (!workspace) return "";
    return (
      workspace.navigationSections
        .flatMap((section) => section.rooms)
        .find((room) => room.id === workspace.activeRoomId)?.membership ?? ""
    );
  });
  const relayAuthAdapter = $derived.by<
    CommunityApplicationAuthAdapter | undefined
  >(() => {
    if (!runtime || !relayAuthMode || !relayAuthPubkey) return undefined;
    const external =
      relayAuthMode === "external" || relayAuthMode === "external-github";
    const session: CommunityAccountSession = {
      account: {
        id: `storybook-${relayAuthMode}`,
        nostr_pubkey: relayAuthPubkey,
        created_at: "2026-09-12T10:00:00Z",
      },
      auth_provider: external ? "nostr" : "google",
      expires_at: "2026-09-19T10:00:00Z",
      identities: !external
        ? [
            {
              provider: "google",
              login: "steve@example.com",
              display_name: "Steve Storybook",
            },
          ]
        : [],
      github_status: external ? "revoked" : "unlinked",
      signer_type: external ? "external" : "managed",
      signer_status: "active",
      passkey_count: external ? 0 : 1,
    };
    const config = {
      providers: ["github", "google"] as const,
      capabilities: {
        github_linking: true,
        github_disconnect: true,
        managed_signing: true,
        nip44: true,
        nip46: true,
        nostr_login: true,
      },
    };
    const baseIdentity: CommunityIdentity =
      relayAuthMode === "expiring"
        ? {
            getPublicKey: () => runtime!.scenario.operator.getPublicKey(),
            signEvent: async (template) => {
              if (template.kind === 7 || template.kind === 5) {
                const { RelayAuthSessionExpiredError } = await import(
                  "../../auth/index.js"
                );
                throw new RelayAuthSessionExpiredError();
              }
              return await runtime!.scenario.operator.signEvent(template);
            },
          }
        : runtime.scenario.operator;
    const restoredIdentity: CommunityIdentity =
      relayAuthIdentityDelayMs <= 0
        ? baseIdentity
        : {
            getPublicKey: async () => {
              await delay(relayAuthIdentityDelayMs);
              return await baseIdentity.getPublicKey();
            },
            signEvent: (template) => baseIdentity.signEvent(template),
            ...(baseIdentity.nip44 === undefined
              ? {}
              : { nip44: baseIdentity.nip44 }),
          };
    if (relayAuthMode === "external-github") {
      let currentSession: CommunityAccountSession = {
        ...session,
        auth_provider: "github",
        identities: [
          {
            provider: "github",
            login: "github-member",
            display_name: "GitHub Member",
          },
        ],
        github_status: "active",
      };
      let disconnectAttempts = 0;
      return new RelayAuthClient({
        relayUrl: "https://relay.story.invalid",
        currentUrl: () => "https://community.story.invalid",
        connectIdentity: () => connectStoryIdentity("browser-extension"),
        fetch: async (request, init) => {
          const path = new URL(request.toString()).pathname;
          if (path.endsWith("/config")) return Response.json(config);
          if (path.endsWith("/session")) return Response.json(currentSession);
          if (path.endsWith("/nostr/challenge"))
            return Response.json({
              challenge: "storybook-nostr-auth-challenge",
              expires_at: "2026-09-19T10:00:00Z",
            });
          if (path.endsWith("/nostr/login"))
            return new Response(null, { status: 204 });
          if (path.endsWith("/github") && init?.method === "DELETE") {
            disconnectAttempts += 1;
            if (disconnectAttempts === 1)
              return Response.json(
                { error: "github_unavailable" },
                { status: 503 },
              );
            currentSession = {
              ...currentSession,
              github_status: "disconnected",
            };
            return new Response(null, { status: 204 });
          }
          if (path.endsWith("/logout"))
            return new Response(null, { status: 204 });
          throw new Error(`Unexpected auth fixture request: ${path}`);
        },
      });
    }
    return {
      restore: async () =>
        !external
          ? {
              status: "connected" as const,
              config,
              session,
              identity: restoredIdentity,
            }
          : { status: "reconnect-required" as const, config, session },
      connect: async (methodId, credentials) => ({
        status: "connected" as const,
        config,
        session,
        identity: await connectStoryIdentity(methodId, credentials),
      }),
      connectGitHub: async () => {
        relayAuthGitHubConnectCount += 1;
      },
      signOut: async () => {
        relayAuthSignOutControllerStatus =
          community?.state.authentication.status ?? "missing";
        relayAuthSignOutCount += 1;
        await delay(relayAuthSignOutDelayMs);
      },
    };
  });

  function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function observeProjectSource(
    source: ProjectForgeDataSource,
  ): ProjectForgeDataSource {
    return {
      async open(context, signal) {
        projectSessionOpenCount += 1;
        const session = await source.open(context, signal);
        return new Proxy(session, {
          get(target, property) {
            if (property === "loadWorkItems")
              return (...args: Parameters<typeof session.loadWorkItems>) => {
                projectWorkItemReadCount += 1;
                return target.loadWorkItems(...args);
              };
            if (property === "subscribe")
              return (...args: Parameters<typeof session.subscribe>) => {
                if (args[0].some((filter) => filter.limit === 0))
                  projectWorkItemSubscribeCount += 1;
                return target.subscribe(...args);
              };
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    };
  }

  onMount(() => {
    let active = true;
    let runtimeGeneration = 0;
    try {
      if (window.location.hash !== "") {
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
      }
      window.localStorage.removeItem(
        COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
      );
      window.localStorage.removeItem(
        COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
      );
    } catch {
      // Story coverage remains available when browser storage is unavailable.
    }
    const remountApplication = (): void => {
      if (persistenceScenario) applicationGeneration += 1;
    };
    const startRuntime = (): void => {
      const currentGeneration = ++runtimeGeneration;
      if (progressiveRetryTimer !== undefined) {
        window.clearTimeout(progressiveRetryTimer);
        progressiveRetryTimer = undefined;
      }
      if (community && community !== runtime?.controller) community.dispose();
      runtime?.dispose();
      runtime = undefined;
      community = undefined;
      runtimeError = "";
      storyInviteUri = "";
      installedPluginIds = [];
      projectSessionOpenCount = 0;
      projectWorkItemReadCount = 0;
      projectWorkItemSubscribeCount = 0;
      projectSource = observeProjectSource(
        createProjectStoryDataSource(
          namespace ? `general-${namespace}` : "general",
          projectBackend,
          emptyProjects,
        ),
      );
      const selectedBackend =
        document.documentElement.dataset.communityBackend ?? "memory";
      const configurationStore =
        selectedBackend === "live"
          ? createBrowserCommunityConfigurationStore({
              prefix: "lapismd.community.story.live.v1",
            })
          : undefined;
      void createCommunityStoryRuntime({
        includePulseFixtures: pulseFixtures,
        ...(configurationStore === undefined ? {} : { configurationStore }),
        ...(namespace === undefined ? {} : { namespace }),
      })
        .then(async (created) => {
          if (!active || currentGeneration !== runtimeGeneration) {
            created.dispose();
            return;
          }
          runtime = created;
          relayAuthPubkey = await created.scenario.operator.getPublicKey();
          if (!active || currentGeneration !== runtimeGeneration) return;
          if (created.backend !== "live") {
            try {
              for (const pubkey of [relayAuthPubkey, "anonymous"]) {
                window.localStorage.removeItem(
                  navigationSectionStorageKey(
                    created.scenario.scope.id,
                    created.scenario.scope.relayUrl,
                    pubkey,
                  ),
                );
              }
            } catch {
              // Tests also support browsers with unavailable preference storage.
            }
          }
          if (
            projects &&
            created.backend !== "memory" &&
            (created.backend === "live" ||
              document.documentElement.dataset.communityProjectForge === "true")
          ) {
            const source = createNip34ProjectForgeDataSource({
              relayFactory: created.relayFactory,
            });
            if (created.backend === "docker") {
              await seedProjectStoryRelay({
                source,
                relayUrl: created.scenario.scope.relayUrl,
                channelId:
                  created.scenario.scope.rooms?.[0]?.groupId ?? "general",
                owner: created.scenario.operator,
                author: created.scenario.member,
              });
            }
            projectSource = observeProjectSource(source);
          }
          const inviteRoom = created.scenario.scope.rooms?.[0];
          if (inviteRoom && created.relayAuthorityPubkey) {
            storyInviteUri = buildCommunityGroupInvite({
              groupId: inviteRoom.groupId,
              relayUrl: created.scenario.scope.relayUrl,
              relayPubkey: created.relayAuthorityPubkey,
              code: "storybook-invite",
            }).uri;
          }
          const participantPubkey =
            await created.scenario.participant.getPublicKey();
          const pulse = {
            agents: [
              {
                pubkey: participantPubkey,
                name: "Noor Automations",
                status: "Projection checks complete",
              },
            ],
          } as const;
          let releaseEventId: string | undefined;
          if (releaseMessages && created.backend === "memory") {
            const releaseGroupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);
            const releaseEvent = await created.scenario.operator.signEvent(
              createNip29ReleaseMessageTemplate(
                "ai",
                {
                  url: "https://example.com/ai-release-manifest.json",
                  mimeType: "application/json",
                  sha256: "0".repeat(64),
                  size: 1,
                },
                1_700_000_020,
                "AI Assistant 1.4.0 is ready for curator review.",
              ),
            );
            const replyEvent = await created.scenario.member.signEvent({
              kind: 9,
              created_at: 1_700_000_021,
              content: "The signed release notes are ready for review.",
              tags: [
                ["h", releaseGroupId],
                ["e", releaseEvent.id, "", "reply"],
              ],
            });
            const memoryRelay = (
              created as CommunityStoryRuntime & {
                relay: { inject(event: typeof releaseEvent): void };
              }
            ).relay;
            memoryRelay.inject(releaseEvent);
            memoryRelay.inject(replyEvent);
            created.controller.dispose();
            community = createCommunityController({
              scopes: [
                {
                  ...created.scenario.scope,
                  rooms: [
                    ...(created.scenario.scope.rooms ?? []),
                    {
                      id: "plugin-releases",
                      groupId: releaseGroupId,
                      name: "plugin-releases",
                      kind: "channel",
                    },
                  ],
                },
              ],
              source: createNip29CommunitySource({
                relayFactory: created.relayFactory,
                ...(created.presenceFetch
                  ? { fetch: created.presenceFetch }
                  : {}),
              }),
              identity: created.scenario.operator,
              pulse,
              now: () => 1_700_000_100,
            });
            releaseEventId = releaseEvent.id;
            const reviewSource = createRegistryStoryDataSource([
              releaseEvent.id,
            ]);
            registrySource = {
              ...reviewSource,
              async loadReleaseReviewEntries() {
                const inspection = await reviewSource.loadReleaseInspection?.(
                  releaseEvent.id,
                );
                return inspection === undefined
                  ? []
                  : [
                      {
                        releaseEvent,
                        inspection,
                        curatorDecisionEvents: [],
                      },
                    ];
              },
            };
          } else if (
            bootstrapDelayMs > 0 ||
            bootstrapFailure ||
            progressiveDelayMs > 0 ||
            progressiveFailure
          ) {
            created.controller.dispose();
            const baseSource = createNip29CommunitySource({
              relayFactory: created.relayFactory,
              ...(created.presenceFetch
                ? { fetch: created.presenceFetch }
                : {}),
            });
            let failNextWindow = progressiveFailure;
            const source: CommunityDataSource = {
              async open(scope, context, signal) {
                const session = await baseSource.open(scope, context, signal);
                const assertBootstrapAvailable = (): void => {
                  if (bootstrapFailure) {
                    throw new Error("Story community bootstrap failed");
                  }
                };
                const delayBootstrap = async (
                  nextSignal?: AbortSignal,
                ): Promise<void> => {
                  if (bootstrapDelayMs <= 0) return;
                  await new Promise((resolve) =>
                    window.setTimeout(resolve, bootstrapDelayMs),
                  );
                  nextSignal?.throwIfAborted();
                };
                return {
                  presence: session.presence,
                  agents: bootstrapFailure ? undefined : session.agents,
                  ...(session.loadPulseWindow === undefined
                    ? {}
                    : {
                        loadPulseWindow: (request, nextSignal) => {
                          assertBootstrapAvailable();
                          return session.loadPulseWindow!(request, nextSignal);
                        },
                      }),
                  snapshot: async (nextSignal) => {
                    await delayBootstrap(nextSignal);
                    assertBootstrapAvailable();
                    return session.snapshot(nextSignal);
                  },
                  synchronize: async (request, nextSignal) => {
                    await delayBootstrap(nextSignal);
                    assertBootstrapAvailable();
                    return session.synchronize === undefined
                      ? session.snapshot(nextSignal)
                      : session.synchronize(request, nextSignal);
                  },
                  loadContentWindow: async (request, nextSignal) => {
                    assertBootstrapAvailable();
                    if (progressiveDelayMs > 0) {
                      await new Promise((resolve) =>
                        window.setTimeout(resolve, progressiveDelayMs),
                      );
                      nextSignal?.throwIfAborted();
                    }
                    if (failNextWindow) {
                      failNextWindow = false;
                      throw new Error(
                        "Story relay paused older history synchronization",
                      );
                    }
                    return session.loadContentWindow!(request, nextSignal);
                  },
                  ...(session.loadGroup === undefined
                    ? {}
                    : {
                        loadGroup: (request, nextSignal) => {
                          assertBootstrapAvailable();
                          return session.loadGroup!(request, nextSignal);
                        },
                      }),
                  subscribe: (listener, nextSignal) =>
                    session.subscribe(listener, nextSignal),
                  execute: (command, nextSignal) =>
                    session.execute(command, nextSignal),
                  search: (query, nextSignal) =>
                    session.search(query, nextSignal),
                  close: () => session.close(),
                };
              },
            };
            community = createCommunityController({
              scopes: [created.scenario.scope],
              source,
              ...(signedIn ? { identity: created.scenario.operator } : {}),
              pulse,
              now: () => 1_700_000_100,
            });
          } else {
            registrySource = createRegistryStoryDataSource();
          }
          if (
            community === undefined &&
            signedIn &&
            loginIdentity === "participant"
          ) {
            created.controller.dispose();
            community = createCommunityController({
              scopes: [created.scenario.scope],
              source: createNip29CommunitySource({
                relayFactory: created.relayFactory,
              }),
              identity: created.scenario.participant,
              runtime:
                created.backend === "live"
                  ? createBrowserCommunityEventRuntime()
                  : createInlineCommunityEventRuntime(),
              pulse,
              now: () => 1_700_000_100,
            });
          }
          community ??= signedIn
            ? created.controller
            : createCommunityController({
                scopes: [created.scenario.scope],
                source: createNip29CommunitySource({
                  relayFactory: created.relayFactory,
                  ...(created.presenceFetch
                    ? { fetch: created.presenceFetch }
                    : {}),
                }),
                runtime:
                  created.backend === "live"
                    ? createBrowserCommunityEventRuntime()
                    : createInlineCommunityEventRuntime(),
                pulse,
                now: () => 1_700_000_100,
              });
          await tick();
          community.initialize();
          if (progressiveFailure) {
            progressiveRetryTimer = window.setTimeout(
              () => void community?.refresh(),
              2_000,
            );
          }
          if (created.backend !== "live" && signedIn) {
            const memberPubkey = await created.scenario.member.getPublicKey();
            if (!active || currentGeneration !== runtimeGeneration) return;
            community.actions.openDirectMessage([memberPubkey]);
            community.actions.selectRoom(
              releaseEventId === undefined ? "general" : "plugin-releases",
            );
          }
        })
        .catch((cause: unknown) => {
          if (active && currentGeneration === runtimeGeneration) {
            runtimeError =
              cause instanceof Error
                ? cause.message
                : "Community story runtime failed";
          }
        });
    };
    window.addEventListener("community-story-backend-change", startRuntime);
    window.addEventListener(
      "community-story-remount-application",
      remountApplication,
    );
    startRuntime();
    return () => {
      active = false;
      runtimeGeneration += 1;
      window.removeEventListener(
        "community-story-backend-change",
        startRuntime,
      );
      window.removeEventListener(
        "community-story-remount-application",
        remountApplication,
      );
      if (community && community !== runtime?.controller) community.dispose();
      runtime?.dispose();
      if (progressiveRetryTimer !== undefined) {
        window.clearTimeout(progressiveRetryTimer);
      }
    };
  });

  async function connectStoryIdentity(
    methodId: string,
    credentials?: CommunityLoginCredentials,
  ): Promise<CommunityIdentity> {
    if (!runtime) throw new Error("The community runtime is not ready");
    if (
      methodId === "private-key" &&
      credentials?.privateKey !== "nsec1storybookexample"
    ) {
      throw new Error("The private key was not handed to the story host");
    }
    return runtime.scenario[loginIdentity];
  }
</script>

{#if runtimeError}
  <div class="community-application-story__unavailable" role="status">
    {runtimeError}
  </div>
{:else if community && runtime}
  {#snippet registryDiscussion()}
    <div class="community-application-story__registry-discussion">
      <RegistryCommunityStoryHarness useHostIdentity />
    </div>
  {/snippet}
  {#key applicationGeneration}
    <CommunityApplication
      controller={observedCommunity ?? community}
      {initialDestination}
      {...useDefaultShell ? {} : { shellController: storyShellController }}
      displayMode={responsive ? "auto" : "desktop"}
      {...responsive ? {} : { desktopMinMainWidth: 0 }}
      data-testid="full-community-application"
      data-community-backend={runtime.backend}
      data-story-active-membership={storyActiveMembership}
      data-story-invite-uri={storyInviteUri}
      data-application-generation={applicationGeneration}
      data-project-session-open-count={projectSessionOpenCount}
      data-project-work-item-read-count={projectWorkItemReadCount}
      data-project-work-item-subscribe-count={projectWorkItemSubscribeCount}
      data-story-relay-auth-sign-out-count={relayAuthSignOutCount}
      data-story-relay-auth-sign-out-controller-status={relayAuthSignOutControllerStatus}
      data-story-controller-auth-status={community.state.authentication.status}
      data-story-relay-auth-github-connect-count={relayAuthGitHubConnectCount}
      registryOptions={{
        source: registrySource,
        discussion: registryDiscussion,
        installActions: {
          ai: {
            state: installedPluginIds.includes("ai")
              ? "installed"
              : "available",
          },
        },
        onInstall: async (request: RegistryInstallRequest) => {
          installedPluginIds = Array.from(
            new Set([...installedPluginIds, request.pluginId]),
          );
        },
      }}
      {...projects ? { projectsOptions: { source: projectSource } } : {}}
      {...signedIn && relayAuthAdapter === undefined
        ? {}
        : {
            loginOptions: {
              allowLocalKeyMethods: true,
              connect: connectStoryIdentity,
              ...(relayAuthAdapter === undefined
                ? {}
                : { auth: relayAuthAdapter }),
            },
          }}
    />
  {/key}
{:else}
  <p class="community-application-story__loading" role="status">
    Preparing signed community events…
  </p>
{/if}

<style>
  .community-application-story__unavailable,
  .community-application-story__loading {
    margin: 1rem;
  }

  .community-application-story__unavailable {
    padding: 1rem;
    border: 1px solid var(--destructive);
    border-radius: var(--radius);
    color: var(--destructive);
  }

  .community-application-story__registry-discussion {
    border-top: 1px solid var(--border);
    padding-top: 2rem;
  }
</style>
