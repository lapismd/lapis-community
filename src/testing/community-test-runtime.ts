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
}

export interface CommunityTestScenario {
  scope: CommunityScope;
  operator: SecretKeyRegistrySigner;
  member: SecretKeyRegistrySigner;
  events: readonly NostrEvent[];
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

export function createCommunityTestScenario(
  options: CommunityTestScenarioOptions = {},
): CommunityTestScenario {
  const relayUrl = options.relayUrl ?? "memory://community.test";
  const createdAt = options.createdAt ?? 1_700_000_000;
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
        ["h", "general"],
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
        ["h", "support"],
        ["name", "support"],
        ["about", "Support forum"],
        ["supported_kinds", "11", "1111", "7"],
      ],
    },
    {
      kind: 0,
      created_at: createdAt + 2,
      content: JSON.stringify({ display_name: "Operator" }),
      tags: [],
    },
    {
      kind: 9,
      created_at: createdAt + 3,
      content: "Welcome to Lapis Community",
      tags: [["h", "general"]],
    },
    {
      kind: 11,
      created_at: createdAt + 4,
      content: "How should portable forums work?",
      tags: [
        ["h", "support"],
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
          ["h", "general"],
          ["p", operatorPubkey],
        ],
      },
      memberKey,
    ),
  );

  const scope: CommunityScope = {
    id: "lapis",
    name: "Lapis Community",
    relayUrl,
    rooms: [
      { id: "general", groupId: "general", name: "general", kind: "channel" },
      { id: "support", groupId: "support", name: "support", kind: "forum" },
    ],
  };
  return {
    scope,
    operator,
    member,
    events,
    async seed(relay) {
      for (const event of events) await relay.publish(event);
      await relay.publish(
        finalizeEvent(
          {
            kind: 9_000,
            created_at: createdAt + 6,
            content: "",
            tags: [
              ["h", "general"],
              ["p", memberPubkey, "member"],
            ],
          },
          operatorKey,
        ),
      );
    },
  };
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
  const scenario = createCommunityTestScenario({ ...options, relayUrl });
  const relayFactory = createWebSocketCommunityRelayFactory();
  const seedRelay = await relayFactory.create(relayUrl);
  try {
    await scenario.seed(seedRelay);
  } finally {
    seedRelay.close();
  }
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
