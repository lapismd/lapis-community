<script lang="ts">
  import { AppShellController } from "@lapismd/design-core/shell";
  import { onMount, tick } from "svelte";

  import {
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
    createNip29ReleaseMessageTemplate,
    LAPIS_GROUPS,
    lapisGroupId,
  } from "../../protocol/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import type { CommunityLoginCredentials } from "../community-login/model.js";
  import RegistryCommunityStoryHarness from "../registry-community/RegistryCommunityStoryHarness.svelte";
  import { createRegistryStoryDataSource } from "../registry-browser/story-fixtures.js";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
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
  } = $props();

  let runtime = $state.raw<CommunityStoryRuntime>();
  let community = $state.raw<CommunityController>();
  let runtimeError = $state("");
  let registrySource = $state.raw(createRegistryStoryDataSource());
  let applicationGeneration = $state(0);
  let installedPluginIds = $state<string[]>([]);
  let progressiveRetryTimer: number | undefined;
  const storyShellController = new AppShellController({ rightClosed: true });

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
      installedPluginIds = [];
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
              }),
              identity: created.scenario.operator,
              pulse,
              now: () => 1_700_000_100,
            });
            releaseEventId = releaseEvent.id;
            registrySource = createRegistryStoryDataSource([releaseEvent.id]);
          } else if (
            bootstrapDelayMs > 0 ||
            bootstrapFailure ||
            progressiveDelayMs > 0 ||
            progressiveFailure
          ) {
            created.controller.dispose();
            const baseSource = createNip29CommunitySource({
              relayFactory: created.relayFactory,
            });
            let failNextWindow = progressiveFailure;
            const source: CommunityDataSource = {
              async open(scope, context, signal) {
                const session = await baseSource.open(scope, context, signal);
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
                  snapshot: async (nextSignal) => {
                    await delayBootstrap(nextSignal);
                    if (bootstrapFailure) {
                      throw new Error("Story community bootstrap failed");
                    }
                    return session.snapshot(nextSignal);
                  },
                  synchronize: async (request, nextSignal) => {
                    await delayBootstrap(nextSignal);
                    if (bootstrapFailure) {
                      throw new Error("Story community bootstrap failed");
                    }
                    return session.synchronize === undefined
                      ? session.snapshot(nextSignal)
                      : session.synchronize(request, nextSignal);
                  },
                  loadContentWindow: async (request, nextSignal) => {
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
              identity: created.scenario.operator,
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
      controller={community}
      {initialDestination}
      {...useDefaultShell ? {} : { shellController: storyShellController }}
      displayMode={responsive ? "auto" : "desktop"}
      {...responsive ? {} : { desktopMinMainWidth: 0 }}
      data-testid="full-community-application"
      data-community-backend={runtime.backend}
      data-application-generation={applicationGeneration}
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
      {...signedIn
        ? {}
        : {
            loginOptions: {
              allowLocalKeyMethods: true,
              connect: connectStoryIdentity,
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
