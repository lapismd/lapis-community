<script lang="ts">
  import { onMount } from "svelte";

  import {
    createBrowserCommunityConfigurationStore,
    createBrowserCommunityEventRuntime,
    createCommunityController,
    createNip29CommunitySource,
    type CommunityIdentity,
    type CommunityController,
  } from "../../community/index.js";
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

  let {
    signedIn = true,
    responsive = false,
    loginIdentity = "operator",
    namespace,
    releaseMessages = false,
  }: {
    signedIn?: boolean;
    responsive?: boolean;
    loginIdentity?: "operator" | "participant";
    namespace?: string;
    releaseMessages?: boolean;
  } = $props();

  let runtime = $state.raw<CommunityStoryRuntime>();
  let community = $state.raw<CommunityController>();
  let runtimeError = $state("");
  let registrySource = $state.raw(createRegistryStoryDataSource());

  onMount(() => {
    let active = true;
    let runtimeGeneration = 0;
    const startRuntime = (): void => {
      const currentGeneration = ++runtimeGeneration;
      if (community && community !== runtime?.controller) community.dispose();
      runtime?.dispose();
      runtime = undefined;
      community = undefined;
      runtimeError = "";
      const selectedBackend =
        document.documentElement.dataset.communityBackend ?? "memory";
      const configurationStore =
        selectedBackend === "live"
          ? createBrowserCommunityConfigurationStore({
              prefix: "lapismd.community.story.live.v1",
            })
          : undefined;
      void createCommunityStoryRuntime({
        ...(configurationStore === undefined ? {} : { configurationStore }),
        ...(namespace === undefined ? {} : { namespace }),
      })
        .then(async (created) => {
          if (!active || currentGeneration !== runtimeGeneration) {
            created.dispose();
            return;
          }
          runtime = created;
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
              now: () => 1_700_000_100,
            });
            releaseEventId = releaseEvent.id;
            registrySource = createRegistryStoryDataSource([releaseEvent.id]);
          } else {
            registrySource = createRegistryStoryDataSource();
          }
          community ??= signedIn
            ? created.controller
            : createCommunityController({
                scopes: [created.scenario.scope],
                source: createNip29CommunitySource({
                  relayFactory: created.relayFactory,
                }),
                runtime: createBrowserCommunityEventRuntime(),
                now: () => 1_700_000_100,
              });
          community.initialize();
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
    startRuntime();
    return () => {
      active = false;
      runtimeGeneration += 1;
      window.removeEventListener(
        "community-story-backend-change",
        startRuntime,
      );
      if (community && community !== runtime?.controller) community.dispose();
      runtime?.dispose();
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
      <RegistryCommunityStoryHarness />
    </div>
  {/snippet}
  <CommunityApplication
    controller={community}
    displayMode={responsive ? "auto" : "desktop"}
    {...responsive ? {} : { desktopMinMainWidth: 0 }}
    extensions={{ activityLog: () => {} }}
    data-testid="full-community-application"
    data-community-backend={runtime.backend}
    registryOptions={{
      source: registrySource,
      discussion: registryDiscussion,
      installActions: { ai: { state: "available" } },
      onInstall: async () => {},
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
