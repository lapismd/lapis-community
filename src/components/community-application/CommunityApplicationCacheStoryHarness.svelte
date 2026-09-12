<script lang="ts">
  import { onMount } from "svelte";

  import {
    createCommunityController,
    createInlineCommunityEventRuntime,
    type CommunityCapabilities,
    type CommunityController,
    type CommunityDataSource,
    type CommunityEventRuntime,
    type CommunityRuntimeRevision,
  } from "../../community/index.js";
  import {
    createCommunityTestScenario,
    createMemoryCommunityEventStore,
  } from "../../testing/index.js";
  import { createRegistryStoryDataSource } from "../registry-browser/story-fixtures.js";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import {
    COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
    COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
  } from "./navigation.js";

  let {
    scenario = "cached-offline",
    registryConfigured = true,
    initialDestination = "inbox",
  }: {
    scenario?:
      | "cached-offline"
      | "cold-offline"
      | "degraded"
      | "mid-session-disconnect"
      | "reconnect"
      | "cached-refresh";
    registryConfigured?: boolean;
    initialDestination?: string;
  } = $props();

  const capabilities: CommunityCapabilities = {
    channels: true,
    forums: true,
    directMessages: true,
    search: true,
    manageGroup: false,
    manageMembers: false,
    deleteEvents: false,
    archive: false,
    editMessages: false,
  };

  let community = $state<CommunityController>();
  let failure = $state("");
  const registrySource = createRegistryStoryDataSource();

  onMount(() => {
    let active = true;
    try {
      window.localStorage.removeItem(
        COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
      );
      window.localStorage.removeItem(
        COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
      );
    } catch {
      // Story coverage remains available when browser storage is unavailable.
    }
    void start().catch((cause: unknown) => {
      if (active)
        failure = cause instanceof Error ? cause.message : "Cache story failed";
    });
    return () => {
      active = false;
      community?.dispose();
    };

    async function start(): Promise<void> {
      const fixture = createCommunityTestScenario({
        relayUrl: "memory://cache-story.test",
        namespace: scenario,
      });
      const store = createMemoryCommunityEventStore();
      if (scenario !== "cold-offline") {
        await store.open();
        await store.commit({
          scope: fixture.scope,
          records: fixture.events.map((event) => ({
            event,
            relayUrl: fixture.scope.relayUrl,
            audience: { type: "public" },
          })),
          checkpoints: [
            {
              relayUrl: fixture.scope.relayUrl,
              stream: "content",
              createdAt: Math.max(
                ...fixture.events.map((event) => event.created_at),
              ),
              synchronizedAt: 1_700_000_100,
            },
          ],
        });
        await store.close();
      }

      let attempts = 0;
      const source: CommunityDataSource = {
        async open() {
          attempts += 1;
          const online =
            scenario === "cached-refresh"
              ? true
              : scenario === "mid-session-disconnect"
                ? attempts === 1
                : scenario === "reconnect"
                  ? attempts > 1
                  : false;
          if (!online) throw new Error("The community relay is unavailable");
          return {
            async snapshot() {
              if (scenario === "cached-refresh") {
                await new Promise((resolve) => setTimeout(resolve, 2_500));
              }
              return { events: fixture.events, capabilities };
            },
            async subscribe() {
              return { close() {} };
            },
            async execute() {
              return [];
            },
            async search() {
              return [];
            },
            close() {},
          };
        },
      };
      const inline = createInlineCommunityEventRuntime({ store });
      const runtime =
        scenario === "degraded"
          ? degradedRuntime(inline, "OPFS unavailable; using durable IndexedDB")
          : inline;
      community = createCommunityController({
        scopes: [fixture.scope],
        source,
        identity: fixture.operator,
        runtime,
        now: () => 1_700_000_200,
      });
      community.initialize();
      if (scenario === "mid-session-disconnect") {
        await waitForStatus(community, "connected");
        await community.reconnect().catch(() => undefined);
      }
    }
  });

  function degradedRuntime(
    runtime: CommunityEventRuntime,
    reason: string,
  ): CommunityEventRuntime {
    const decorate = (
      revision: CommunityRuntimeRevision,
    ): CommunityRuntimeRevision => ({
      ...revision,
      cache: { ...revision.cache, degradedReason: reason },
    });
    return {
      restore: async (scopes, generation) =>
        decorate(await runtime.restore(scopes, generation)),
      ingest: async (batch) => {
        const revision = await runtime.ingest(batch);
        return revision === undefined ? undefined : decorate(revision);
      },
      project: async (selection) => decorate(await runtime.project(selection)),
      search: (request) => runtime.search(request),
      clear: (scope) => runtime.clear(scope),
      dispose: () => runtime.dispose(),
    };
  }

  async function waitForStatus(
    controller: CommunityController,
    expected: CommunityController["state"]["status"],
  ): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (controller.state.status === expected) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${expected}`);
  }
</script>

{#if failure}
  <p class="community-cache-story__error" role="alert">{failure}</p>
{:else if community}
  <CommunityApplication
    controller={community}
    displayMode="desktop"
    desktopMinMainWidth={0}
    {initialDestination}
    {...registryConfigured
      ? { registryOptions: { source: registrySource } }
      : {}}
    data-cache-scenario={scenario}
    data-cache-active-room={community.state.workspace.activeRoomId}
    data-cache-message-count={community.state.workspace.messages.length}
    data-cache-topic-count={community.state.workspace.topics.length}
  />
{:else}
  <p class="community-cache-story__loading" role="status">
    Restoring local events…
  </p>
{/if}

<style>
  .community-cache-story__error,
  .community-cache-story__loading {
    margin: 1rem;
  }

  .community-cache-story__error {
    color: var(--destructive);
  }
</style>
