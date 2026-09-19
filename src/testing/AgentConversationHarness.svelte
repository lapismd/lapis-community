<script lang="ts">
  import type { Snippet } from "svelte";
  import { provideAgentConversation } from "../components/community-agent-conversation/context.svelte.js";
  import type { ProjectForgeSession } from "../projects/data-source.js";
  import type { NostrEventTemplate } from "../protocol/index.js";
  import {
    events,
    signOwner,
    owner,
    agent,
  } from "./agent-conversation-fixture.js";
  let {
    children,
    onPublish,
    onOpen,
    extraEvents = [],
  }: {
    children: Snippet;
    extraEvents?: import("../protocol/index.js").NostrEvent[];
    onPublish?: (template: NostrEventTemplate) => void;
    onOpen?: (room: string, root: string, reply?: string) => void;
  } = $props();
  let opened = $state("");
  const session = {
    queryHttp: async () => [...events, ...extraEvents],
    subscribe: async () => () => {},
    publish: async (template: NostrEventTemplate) => {
      onPublish?.(template);
      return signOwner(template);
    },
  } as unknown as ProjectForgeSession;
  provideAgentConversation({
    session: () => session,
    memberId: () => owner,
    members: () => [
      {
        id: owner,
        name: "Operator",
        handle: "operator",
        initials: "OP",
        role: "administrator",
        online: true,
      },
      {
        id: agent,
        name: "Nyra",
        handle: "nyra",
        initials: "NY",
        role: "writer",
        presence: "online",
        isAgent: true,
      },
    ],
    rooms: () => [
      {
        id: "room",
        groupId: "room",
        name: "demo",
        kind: "channel",
        unreadCount: 0,
      },
    ],
    openThread: (room, root, reply) => {
      opened = `Thread ${root}`;
      onOpen?.(room, root, reply);
    },
  });
</script>

{@render children()}
{#if opened}<p role="status">{opened}</p>{/if}
