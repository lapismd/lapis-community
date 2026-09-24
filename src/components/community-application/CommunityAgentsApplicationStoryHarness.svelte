<script lang="ts">
  import { onMount } from "svelte";
  import PermissionFixture from "./ApplicationPermissionStoryFixture.svelte";
  import {
    publishStoryActivity,
    installStoryPermissionReplay,
  } from "../../testing/application-permission-fixture.js";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { AppShellController } from "@lapismd/design-core/shell";
  import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
  import * as nip44 from "nostr-tools/nip44";
  import {
    createCommunityController,
    createNip29CommunitySource,
    type CommunityController,
  } from "../../community/index.js";
  import {
    createCommunityTestRuntime,
    type CommunityTestRuntime,
  } from "../../testing/index.js";
  import type { RelayFilter } from "../../nostr/index.js";
  import {
    storyAgentKey,
    storyAgentPubkey,
    storyAgentProfile,
    storyOwnerPubkey,
  } from "../community-agents/story-fixtures.js";
  import CommunityApplication from "./CommunityApplicationRoot.svelte";
  import { COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY } from "./navigation.js";
  let {
    narrow = false,
    showControls = true,
    manualProcessing = false,
    notifications = false,
    replayPermission = false,
  }: {
    narrow?: boolean;
    showControls?: boolean;
    manualProcessing?: boolean;
    notifications?: boolean;
    replayPermission?: boolean;
  } = $props();
  let controller = $state.raw<CommunityController>();
  let runtime = $state.raw<CommunityTestRuntime>();
  let error = $state("");
  let mounted = $state(true);
  let received = $state(false);
  let processing = {
    enabled: true,
    revision: 0,
    status: "applied" as const,
    updatedAt: 0,
  };
  let pendingProcessing = $state<{
    requestId: string;
    enabled: boolean;
    expectedRevision: number;
  }>();
  let controlSequence = 0;
  async function acknowledgeProcessing(request: {
    requestId: string;
    enabled?: boolean;
    expectedRevision?: number;
  }) {
    if (!runtime) return;
    if (request.enabled !== undefined) {
      if (request.expectedRevision !== processing.revision)
        throw new Error("Processing revision changed");
      processing = {
        ...processing,
        enabled: request.enabled,
        revision: processing.revision + 1,
        updatedAt: Date.now(),
      };
    }
    await runtime.relay.publish(
      finalizeEvent(
        {
          kind: 24200,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["p", storyOwnerPubkey],
            ["agent", storyAgentPubkey],
            ["frame", "telemetry"],
          ],
          content: nip44.v2.encrypt(
            JSON.stringify({
              version: 2,
              seq: ++controlSequence,
              timestamp: new Date().toISOString(),
              kind: "processing_state",
              payload: {
                ...processing,
                requestId: request.requestId,
                applied: true,
              },
            }),
            nip44.v2.utils.getConversationKey(storyAgentKey, storyOwnerPubkey),
          ),
        },
        storyAgentKey,
      ),
    );
    pendingProcessing = undefined;
  }
  const shell = new AppShellController({ rightClosed: true });
  onMount(() => {
    let active = true;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    localStorage.removeItem(COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY);
    void createCommunityTestRuntime({
      createdAt: Math.floor(Date.now() / 1000) - 100,
      relayUrl: "wss://agent-community.example/",
    })
      .then(async (created) => {
        if (!active) {
          created.dispose();
          return;
        }
        runtime = created;
        const { relay, scenario } = created;
        await relay.subscribe(
          {
            kinds: [24200],
            authors: [storyOwnerPubkey],
            "#p": [storyAgentPubkey],
          },
          {
            onevent: (event) => {
              if (
                !event.tags.some(
                  ([name, value]) => name === "frame" && value === "control",
                )
              )
                return;
              const request = JSON.parse(
                nip44.v2.decrypt(
                  event.content,
                  nip44.v2.utils.getConversationKey(
                    storyAgentKey,
                    storyOwnerPubkey,
                  ),
                ),
              );
              if (
                request.command === "processing_get" ||
                request.command === "processing_set"
              ) {
                if (manualProcessing && request.command === "processing_set")
                  pendingProcessing = request;
                else
                  void acknowledgeProcessing(request).catch(
                    (cause) => (error = String(cause)),
                  );
              }
            },
          },
        );
        relay.inject(storyAgentProfile);
        await relay.publish(
          await scenario.operator.signEvent({
            kind: 30177,
            created_at: Math.floor(Date.now() / 1000),
            content: "",
            tags: [["d", storyAgentPubkey]],
          }),
        );
        await relay.publish(
          await scenario.operator.signEvent({
            kind: 9000,
            created_at: Math.floor(Date.now() / 1000),
            content: "",
            tags: [
              ["h", "general"],
              ["p", storyAgentPubkey],
            ],
          }),
        );
        const fetchBridge: typeof fetch = async (_input, init) => {
          if (!init?.body)
            return Response.json({
              self: getPublicKey(new Uint8Array(32).fill(23)),
              supported_nips: [29, 44, "OA", "AO"],
            });
          const filters = JSON.parse(String(init.body)) as RelayFilter[];
          return Response.json(
            (
              await Promise.all(
                filters
                  .filter((filter) => !filter.kinds?.includes(40902))
                  .map((filter) => relay.query(filter)),
              )
            ).flat(),
          );
        };
        controller = createCommunityController({
          scopes: [scenario.scope],
          identity: scenario.operator,
          source: createNip29CommunitySource({
            relayFactory: created.relayFactory,
            fetch: fetchBridge,
          }),
        });
        if (replayPermission) installStoryPermissionReplay(created);
        controller.initialize();
      })
      .catch((cause) => (error = String(cause)));
    return () => {
      active = false;
      controller?.dispose();
      runtime?.dispose();
    };
  });
  async function emitActivity() {
    if (!runtime) return;
    await publishStoryActivity(runtime, "turn_started", {
      scopeKey: "relay/general/agent/channel",
      entry: {
        id: "story-request",
        type: "message",
        role: "user",
        text: "Captured while the activity panel was closed",
        authorPubkey: storyOwnerPubkey,
        createdAt: new Date().toISOString(),
      },
    });
    received = true;
  }
</script>

<div class="agent-application-story" style:width={narrow ? "390px" : "100%"}>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if controller}
    {#if showControls}
      <div class="agent-application-story__controls">
        <Button
          size="sm"
          disabled={controller.state.agents?.status !== "ready"}
          onclick={emitActivity}>Emit fixture activity</Button
        >{#if received}<span role="status">Fixture event delivered</span>{/if}
      </div>
    {/if}
    {#if pendingProcessing}
      <Button onclick={() => void acknowledgeProcessing(pendingProcessing!)}
        >Acknowledge processing change</Button
      >
    {/if}
    {#if notifications && runtime}
      <PermissionFixture {runtime} {controller} bind:mounted />
    {/if}
    {#if mounted}<CommunityApplication
        {controller}
        shellController={shell}
        initialDestination="agents"
        displayMode="auto"
        registryEnabled={false}
      />{/if}
  {:else}<p role="status">Preparing agent community…</p>{/if}
</div>

<style>
  .agent-application-story {
    height: 100vh;
    max-width: 100%;
    display: flex;
    flex-direction: column;
  }
  .agent-application-story__controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    flex-shrink: 0;
  }
</style>
