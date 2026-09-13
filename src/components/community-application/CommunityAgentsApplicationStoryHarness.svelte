<script lang="ts">
  import { onMount } from "svelte";
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
  let { narrow = false }: { narrow?: boolean } = $props();
  let controller = $state.raw<CommunityController>();
  let runtime = $state.raw<CommunityTestRuntime>();
  let error = $state("");
  let received = $state(false);
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
    const now = Math.floor(Date.now() / 1000);
    await runtime.relay.publish(
      finalizeEvent(
        {
          kind: 24200,
          created_at: now,
          tags: [
            ["p", storyOwnerPubkey],
            ["agent", storyAgentPubkey],
            ["frame", "telemetry"],
            ["h", "general"],
          ],
          content: nip44.v2.encrypt(
            JSON.stringify({
              version: 2,
              seq: 1,
              timestamp: new Date().toISOString(),
              kind: "turn_started",
              channelId: "general",
              turnId: "story",
              payload: {
                scopeKey: "relay/general/agent/channel",
                entry: {
                  id: "story-request",
                  type: "message",
                  role: "user",
                  text: "Captured while the activity panel was closed",
                  authorPubkey: storyOwnerPubkey,
                  createdAt: new Date().toISOString(),
                },
              },
            }),
            nip44.v2.utils.getConversationKey(storyAgentKey, storyOwnerPubkey),
          ),
        },
        storyAgentKey,
      ),
    );
    received = true;
  }
</script>

<div class="agent-application-story" style:width={narrow ? "390px" : "100%"}>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if controller}
    <div class="agent-application-story__controls">
      <Button
        size="sm"
        disabled={controller.state.agents?.status !== "ready"}
        onclick={emitActivity}>Emit fixture activity</Button
      >{#if received}<span role="status">Fixture event delivered</span>{/if}
    </div>
    <CommunityApplication
      {controller}
      shellController={shell}
      initialDestination="agents"
      displayMode="auto"
      registryEnabled={false}
    />
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
