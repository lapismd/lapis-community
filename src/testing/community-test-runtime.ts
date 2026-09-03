import { SecretKeyRegistrySigner } from "../auth/index.js";
import {
  createCommunityController,
  createBrowserCommunityEventRuntime,
  createNip07CommunityIdentityConnector,
  createNip29CommunitySource,
  type CommunityConfigurationStore,
  type CommunityController,
  type CommunityScope,
} from "../community/index.js";
import {
  createWebSocketCommunityRelayFactory,
  type CommunityRelay,
  type CommunityRelayFactory,
} from "../nostr/index.js";
import {
  LAPIS_GROUPS,
  createNip29ForumCommentTemplate,
  lapisGroupId,
  type NostrEvent,
  type NostrEventTemplate,
} from "../protocol/index.js";
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
  participant: SecretKeyRegistrySigner;
  events: readonly NostrEvent[];
  commands: readonly NostrEvent[];
  seed(relay: CommunityRelay): Promise<void>;
}

export type CommunityStoryBackend = "memory" | "docker" | "live";

export interface CommunityStoryRuntimeOptions
  extends CommunityTestScenarioOptions {
  backend?: CommunityStoryBackend;
  relayUrl?: string;
  liveChannelGroupId?: string;
  liveForumGroupId?: string;
  configurationStore?: CommunityConfigurationStore;
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
const participantKey = new Uint8Array(32).fill(24);
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
  const participant = new SecretKeyRegistrySigner(participantKey);
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
        name: "steve",
        about: "Building calm, portable community tools.",
        picture: storyIdentityAvatarUrl,
      }),
      tags: [],
    },
    {
      kind: 30_030,
      created_at: createdAt + 2,
      content: "",
      tags: [
        ["d", "emojis"],
        ["emoji", "lapis", storyIdentityAvatarUrl],
      ],
    },
    {
      kind: 10_050,
      created_at: createdAt + 2,
      content: "",
      tags: [["relay", relayUrl]],
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
  const forumRoot = events.find((event) => event.kind === 11);
  if (forumRoot === undefined) throw new Error("Forum fixture root is missing");
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
        kind: 0,
        created_at: createdAt + 2,
        content: JSON.stringify({ display_name: "Noor" }),
        tags: [],
      },
      participantKey,
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
    finalizeEvent(
      {
        kind: 10_050,
        created_at: createdAt + 2,
        content: "",
        tags: [["relay", relayUrl]],
      },
      memberKey,
    ),
    finalizeEvent(
      createNip29ForumCommentTemplate(
        supportGroupId,
        forumRoot,
        forumRoot,
        "Portable forum URLs should retain relay and group identity.",
        createdAt + 7,
        relayUrl,
      ),
      memberKey,
    ),
    finalizeEvent(
      createNip29ForumCommentTemplate(
        supportGroupId,
        forumRoot,
        forumRoot,
        "The topic list should make recent participants easy to scan.",
        createdAt + 8,
        relayUrl,
      ),
      participantKey,
    ),
    finalizeEvent(
      createNip29ForumCommentTemplate(
        supportGroupId,
        forumRoot,
        forumRoot,
        "Agreed. The reply and activity columns should stay aligned.",
        createdAt + 9,
        relayUrl,
      ),
      operatorKey,
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
    id: suffix ? `lapis-${suffix}` : "lapis",
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
    participant,
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
  const participantPubkey = await scenario.participant.getPublicKey();
  const identities = new Map([
    [operatorPubkey, scenario.operator],
    [memberPubkey, scenario.member],
    [participantPubkey, scenario.participant],
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
      `${backend === "live" ? "Live" : "Docker"} relay unavailable. Provide the matching Storybook relay URL.`,
    );
  }
  const scenario = createCommunityTestScenario({
    ...options,
    relayUrl,
    namespace: options.namespace ?? crypto.randomUUID(),
  });
  const relayFactory = createWebSocketCommunityRelayFactory();
  if (backend === "docker") {
    await seedCommunityTestScenario(scenario, relayFactory);
  }
  const liveScope: CommunityScope =
    backend === "live"
      ? {
          ...scenario.scope,
          discoverPublicRooms: true,
          rooms: [
            {
              id: "general",
              groupId:
                options.liveChannelGroupId ??
                configured.liveChannelGroupId ??
                lapisGroupId(LAPIS_GROUPS.general),
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
              groupId:
                options.liveForumGroupId ??
                configured.liveForumGroupId ??
                lapisGroupId(LAPIS_GROUPS.forums),
              name: "forums",
              kind: "forum",
            },
          ],
        }
      : scenario.scope;
  const controller = createCommunityController({
    scopes: [liveScope],
    source: createNip29CommunitySource({ relayFactory }),
    ...(backend === "live"
      ? { identityConnector: createNip07CommunityIdentityConnector() }
      : { identity: scenario.operator }),
    ...(options.configurationStore === undefined
      ? {}
      : { configurationStore: options.configurationStore }),
    runtime: createBrowserCommunityEventRuntime(),
    now:
      backend === "live"
        ? () => Math.floor(Date.now() / 1_000)
        : () => (options.createdAt ?? 1_700_000_000) + 100,
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
  liveChannelGroupId?: string;
  liveForumGroupId?: string;
} {
  if (typeof document === "undefined") return { backend: "memory" };
  const backend =
    document.documentElement.dataset.communityBackend === "docker"
      ? "docker"
      : document.documentElement.dataset.communityBackend === "live"
        ? "live"
        : "memory";
  const relayUrl =
    backend === "live"
      ? document.documentElement.dataset.communityLiveRelayUrl
      : document.documentElement.dataset.communityRelayUrl;
  return {
    backend,
    ...(relayUrl === undefined || relayUrl === "" ? {} : { relayUrl }),
    ...(document.documentElement.dataset.communityLiveChannelGroupId
      ? {
          liveChannelGroupId:
            document.documentElement.dataset.communityLiveChannelGroupId,
        }
      : {}),
    ...(document.documentElement.dataset.communityLiveForumGroupId
      ? {
          liveForumGroupId:
            document.documentElement.dataset.communityLiveForumGroupId,
        }
      : {}),
  };
}

function publicKey(secretKey: Uint8Array): string {
  return finalizeEvent(
    { kind: 0, created_at: 0, content: "", tags: [] },
    secretKey,
  ).pubkey;
}
