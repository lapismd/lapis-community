import { SecretKeyRegistrySigner } from "../auth/index.js";
import {
  createCommunityController,
  createNip29CommunitySource,
  type CommunityController,
  type CommunityScope,
} from "../community/index.js";
import {
  createWebSocketCommunityRelayFactory,
  type CommunityRelay,
  type CommunityRelayFactory,
} from "../nostr/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import { finalizeEvent } from "nostr-tools/pure";

import {
  Nip29MemoryPolicy,
  createInMemoryRelayFactory,
  type InMemoryCommunityRelay,
  type InMemoryCommunityRelayFactory,
  type InMemoryRelayFaults,
} from "./in-memory-community-relay.js";

export interface CommunityTestScenarioOptions {
  relayUrl?: string;
  createdAt?: number;
  namespace?: string;
}

export interface CommunityTestScenario {
  scope: CommunityScope;
  operator: SecretKeyRegistrySigner;
  member: SecretKeyRegistrySigner;
  events: readonly NostrEvent[];
  commands: readonly NostrEvent[];
  seed(relay: CommunityRelay): Promise<void>;
}

export type CommunityStoryBackend = "memory" | "docker";

export interface CommunityStoryRuntimeOptions
  extends CommunityTestScenarioOptions {
  backend?: CommunityStoryBackend;
  relayUrl?: string;
}

export interface CommunityStoryRuntime {
  backend: CommunityStoryBackend;
  controller: CommunityController;
  relayFactory: CommunityRelayFactory;
  scenario: CommunityTestScenario;
  dispose(): void;
}

export interface CommunityTestRuntimeOptions
  extends CommunityTestScenarioOptions {
  faults?: InMemoryRelayFaults;
}

export interface CommunityTestRuntime {
  controller: CommunityController;
  relayFactory: InMemoryCommunityRelayFactory;
  relay: InMemoryCommunityRelay;
  scenario: CommunityTestScenario;
  dispose(): void;
}

const operatorKey = new Uint8Array(32).fill(21);
const memberKey = new Uint8Array(32).fill(22);
const relayKey = new Uint8Array(32).fill(23);
const storyIdentityAvatarUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%232563eb'/%3E%3Ctext x='32' y='41' text-anchor='middle' font-family='system-ui' font-size='30' font-weight='700' fill='white'%3ES%3C/text%3E%3C/svg%3E";

export function createCommunityTestScenario(
  options: CommunityTestScenarioOptions = {},
): CommunityTestScenario {
  const relayUrl = options.relayUrl ?? "memory://community.test";
  const createdAt = options.createdAt ?? 1_700_000_000;
  const suffix = options.namespace?.trim();
  const generalGroupId = suffix ? `general-${suffix}` : "general";
  const supportGroupId = suffix ? `support-${suffix}` : "support";
  const operator = new SecretKeyRegistrySigner(operatorKey);
  const member = new SecretKeyRegistrySigner(memberKey);
  const operatorPubkey = publicKey(operatorKey);
  const memberPubkey = publicKey(memberKey);
  const templates: NostrEventTemplate[] = [
    {
      kind: 9_007,
      created_at: createdAt,
      content: JSON.stringify({ name: "general", about: "Community chat" }),
      tags: [
        ["h", generalGroupId],
        ["name", "general"],
        ["about", "Community chat"],
        ["supported_kinds", "9", "7"],
      ],
    },
    {
      kind: 9_007,
      created_at: createdAt + 1,
      content: JSON.stringify({ name: "support", about: "Support forum" }),
      tags: [
        ["h", supportGroupId],
        ["name", "support"],
        ["about", "Support forum"],
        ["supported_kinds", "11", "1111", "7"],
      ],
    },
    {
      kind: 0,
      created_at: createdAt + 2,
      content: JSON.stringify({
        display_name: "steve",
        picture: storyIdentityAvatarUrl,
      }),
      tags: [],
    },
    {
      kind: 9,
      created_at: createdAt + 3,
      content: "Welcome to Lapis Community",
      tags: [["h", generalGroupId]],
    },
    {
      kind: 11,
      created_at: createdAt + 4,
      content: "How should portable forums work?",
      tags: [
        ["h", supportGroupId],
        ["title", "Portable forums"],
      ],
    },
  ];
  const events = templates.map((template) =>
    finalizeEvent(template, operatorKey),
  );
  events.push(
    finalizeEvent(
      {
        kind: 0,
        created_at: createdAt + 2,
        content: JSON.stringify({ display_name: "Member" }),
        tags: [],
      },
      memberKey,
    ),
    finalizeEvent(
      {
        kind: 9,
        created_at: createdAt + 5,
        content: "Hello from a member",
        tags: [
          ["h", generalGroupId],
          ["p", operatorPubkey],
        ],
      },
      memberKey,
    ),
  );
  const commands = [
    finalizeEvent(
      {
        kind: 9_000,
        created_at: createdAt + 6,
        content: "",
        tags: [
          ["h", generalGroupId],
          ["p", memberPubkey, "member"],
        ],
      },
      operatorKey,
    ),
  ];

  const scope: CommunityScope = {
    id: "lapis",
    name: "Lapis Community",
    relayUrl,
    rooms: [
      {
        id: "general",
        groupId: generalGroupId,
        name: "general",
        kind: "channel",
      },
      {
        id: "support",
        groupId: supportGroupId,
        name: "support",
        kind: "forum",
      },
    ],
  };
  return {
    scope,
    operator,
    member,
    events,
    commands,
    async seed(relay) {
      for (const event of events) await relay.publish(event);
      for (const event of commands) await relay.publish(event);
    },
  };
}

export async function seedCommunityTestScenario(
  scenario: CommunityTestScenario,
  relayFactory: CommunityRelayFactory,
): Promise<void> {
  const operatorPubkey = await scenario.operator.getPublicKey();
  const memberPubkey = await scenario.member.getPublicKey();
  const identities = new Map([
    [operatorPubkey, scenario.operator],
    [memberPubkey, scenario.member],
  ]);
  const relays = new Map<string, CommunityRelay>();
  try {
    for (const event of [...scenario.events, ...scenario.commands]) {
      const identity = identities.get(event.pubkey);
      if (identity === undefined) {
        throw new Error("Scenario event author has no fixture identity");
      }
      let relay = relays.get(event.pubkey);
      if (relay === undefined) {
        relay = relayFactory.create(scenario.scope.relayUrl);
        await relay.authenticate?.((template) => identity.signEvent(template));
        relays.set(event.pubkey, relay);
      }
      await relay.publish(event);
    }
  } finally {
    for (const relay of relays.values()) relay.close();
  }
}

export async function createCommunityTestRuntime(
  options: CommunityTestRuntimeOptions = {},
): Promise<CommunityTestRuntime> {
  const scenario = createCommunityTestScenario(options);
  const policy = new Nip29MemoryPolicy({
    relaySecretKey: relayKey,
    now: () => options.createdAt ?? 1_700_000_000,
  });
  const relayFactory = createInMemoryRelayFactory({
    policy,
    ...(options.faults === undefined ? {} : { faults: options.faults }),
  });
  const relay = relayFactory.relay(scenario.scope.relayUrl);
  await scenario.seed(relay);
  const source = createNip29CommunitySource({ relayFactory });
  const controller = createCommunityController({
    scopes: [scenario.scope],
    source,
    identity: scenario.operator,
    now: () => (options.createdAt ?? 1_700_000_000) + 100,
  });
  return {
    controller,
    relayFactory,
    relay,
    scenario,
    dispose() {
      controller.dispose();
      relayFactory.reset();
    },
  };
}

/**
 * Creates the runtime used by composed Storybook examples. The backend is read
 * from the Storybook decorator when it is not supplied explicitly, so story
 * components never branch production controller or materializer logic.
 */
export async function createCommunityStoryRuntime(
  options: CommunityStoryRuntimeOptions = {},
): Promise<CommunityStoryRuntime> {
  const configured = storybookConfiguration();
  const backend = options.backend ?? configured.backend;
  if (backend === "memory") {
    const runtime = await createCommunityTestRuntime(options);
    return { ...runtime, backend };
  }

  const relayUrl = options.relayUrl ?? configured.relayUrl;
  if (relayUrl === undefined || relayUrl === "") {
    throw new Error(
      "Docker relay unavailable. Start it with pnpm storybook:relay or provide VITE_COMMUNITY_RELAY_URL.",
    );
  }
  const scenario = createCommunityTestScenario({
    ...options,
    relayUrl,
    namespace: options.namespace ?? crypto.randomUUID(),
  });
  const relayFactory = createWebSocketCommunityRelayFactory();
  await seedCommunityTestScenario(scenario, relayFactory);
  const controller = createCommunityController({
    scopes: [scenario.scope],
    source: createNip29CommunitySource({ relayFactory }),
    identity: scenario.operator,
    now: () => (options.createdAt ?? 1_700_000_000) + 100,
  });
  return {
    backend,
    controller,
    relayFactory,
    scenario,
    dispose() {
      controller.dispose();
    },
  };
}

function storybookConfiguration(): {
  backend: CommunityStoryBackend;
  relayUrl?: string;
} {
  if (typeof document === "undefined") return { backend: "memory" };
  const backend =
    document.documentElement.dataset.communityBackend === "docker"
      ? "docker"
      : "memory";
  const relayUrl = document.documentElement.dataset.communityRelayUrl;
  return {
    backend,
    ...(relayUrl === undefined || relayUrl === "" ? {} : { relayUrl }),
  };
}

function publicKey(secretKey: Uint8Array): string {
  return finalizeEvent(
    { kind: 0, created_at: 0, content: "", tags: [] },
    secretKey,
  ).pubkey;
}
