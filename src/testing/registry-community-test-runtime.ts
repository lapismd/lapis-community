import { SecretKeyRegistrySigner, type RegistrySigner } from "../auth/index.js";
import {
  createRegistryCommunityDataSource,
  type RegistryCommunityDataSource,
} from "../community/index.js";
import {
  createWebSocketCommunityRelayFactory,
  type CommunityRelay,
  type CommunityRelayFactory,
} from "../nostr/index.js";
import {
  LAPIS_GROUPS,
  NIP29_KINDS,
  createNip29ForumCommentTemplate,
  createNip29ForumThreadTemplate,
  createNip29ReleaseMessageTemplate,
  lapisGroupId,
  lapisPluginSupportGroupId,
  type NostrEvent,
} from "../protocol/index.js";
import { finalizeEvent } from "nostr-tools/pure";

import {
  createInMemoryRelayFactory,
  type InMemoryCommunityRelayFactory,
} from "./in-memory-community-relay.js";
import type { CommunityStoryBackend } from "./community-test-runtime.js";

export interface RegistryCommunityTestScenarioOptions {
  relayUrl?: string;
  plugin?: string;
  name?: string;
  version?: string;
  createdAt?: number;
  namespace?: string;
}

export interface RegistryCommunityTestScenario {
  relayUrl: string;
  plugin: string;
  name: string;
  version: string;
  publisher: string;
  identity: SecretKeyRegistrySigner;
  member: SecretKeyRegistrySigner;
  events: readonly NostrEvent[];
  seed(relay: CommunityRelay): Promise<void>;
}

export interface RegistryCommunityStoryRuntime {
  backend: CommunityStoryBackend;
  dataSource: RegistryCommunityDataSource;
  relayFactory: CommunityRelayFactory;
  scenario: RegistryCommunityTestScenario;
  identity?: RegistrySigner;
  dispose(): void;
}

const publisherKey = new Uint8Array(32).fill(21);
const memberKey = new Uint8Array(32).fill(22);

export function createRegistryCommunityTestScenario(
  options: RegistryCommunityTestScenarioOptions = {},
): RegistryCommunityTestScenario {
  const relayUrl = options.relayUrl ?? "ws://registry-community.test/";
  const createdAt = options.createdAt ?? 1_700_100_000;
  const namespace = options.namespace?.trim();
  const plugin = namespace
    ? `${options.plugin ?? "registry-demo"}-${normalizeNamespace(namespace)}`
    : (options.plugin ?? "registry-demo");
  const name = options.name ?? "Registry Demo";
  const version = options.version ?? "1.2.3";
  const identity = new SecretKeyRegistrySigner(publisherKey);
  const member = new SecretKeyRegistrySigner(memberKey);
  const publisher = publicKey(publisherKey);
  const memberPubkey = publicKey(memberKey);
  const groupId = lapisPluginSupportGroupId(plugin);
  const releaseGroupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);
  const release = finalizeEvent(
    createNip29ReleaseMessageTemplate(
      plugin,
      {
        url: "https://fixtures.invalid/registry-demo.json",
        mimeType: "application/json",
        sha256: "a".repeat(64),
        size: 128,
        filename: "registry-demo.json",
      },
      createdAt + 2,
      `${name} ${version} is available.`,
    ),
    publisherKey,
  );
  const thread = finalizeEvent(
    createNip29ForumThreadTemplate(
      groupId,
      "Seeded registry discussion",
      createdAt + 3,
    ),
    memberKey,
  );
  const reply = finalizeEvent(
    createNip29ForumCommentTemplate(
      groupId,
      thread,
      thread,
      "The shared controller boundary keeps this portable.",
      createdAt + 4,
      relayUrl,
    ),
    publisherKey,
  );
  const events = [
    finalizeEvent(
      {
        kind: 9_007,
        created_at: createdAt - 3,
        content: JSON.stringify({ name: `${name} support` }),
        tags: [
          ["h", groupId],
          ["name", `${name} support`],
          ["supported_kinds", "11", "1111", "7"],
        ],
      },
      publisherKey,
    ),
    finalizeEvent(
      {
        kind: 9_007,
        created_at: createdAt - 2,
        content: JSON.stringify({ name: "Plugin releases" }),
        tags: [
          ["h", releaseGroupId],
          ["name", "Plugin releases"],
          ["supported_kinds", "9", "7"],
        ],
      },
      publisherKey,
    ),
    finalizeEvent(
      {
        kind: 9_000,
        created_at: createdAt - 1,
        content: "",
        tags: [
          ["h", groupId],
          ["p", memberPubkey, "member"],
        ],
      },
      publisherKey,
    ),
    finalizeEvent(
      {
        kind: 0,
        created_at: createdAt,
        content: JSON.stringify({ display_name: "Publisher" }),
        tags: [],
      },
      publisherKey,
    ),
    finalizeEvent(
      {
        kind: 0,
        created_at: createdAt + 1,
        content: JSON.stringify({ display_name: "Community member" }),
        tags: [],
      },
      memberKey,
    ),
    release,
    thread,
    reply,
    finalizeEvent(
      {
        kind: NIP29_KINDS.reaction,
        created_at: createdAt + 5,
        content: "👍",
        tags: [
          ["e", release.id],
          ["p", release.pubkey],
          ["k", release.kind.toString()],
        ],
      },
      memberKey,
    ),
  ];

  return {
    relayUrl,
    plugin,
    name,
    version,
    publisher,
    identity,
    member,
    events,
    async seed(relay) {
      for (const event of events) await relay.publish(event);
    },
  };
}

export async function seedRegistryCommunityTestScenario(
  scenario: RegistryCommunityTestScenario,
  relayFactory: CommunityRelayFactory,
): Promise<void> {
  const identities = new Map([
    [scenario.publisher, scenario.identity],
    [await scenario.member.getPublicKey(), scenario.member],
  ]);
  const relays = new Map<string, CommunityRelay>();
  try {
    for (const event of scenario.events) {
      const identity = identities.get(event.pubkey);
      if (identity === undefined) {
        throw new Error(
          "Registry scenario event author has no fixture identity",
        );
      }
      let relay = relays.get(event.pubkey);
      if (relay === undefined) {
        relay = relayFactory.create(scenario.relayUrl);
        relays.set(event.pubkey, relay);
      }
      await relay.authenticate?.((template) => identity.signEvent(template));
      await relay.publish(event);
    }
  } finally {
    for (const relay of new Set(relays.values())) relay.close();
  }
}

export async function createRegistryCommunityStoryRuntime(
  options: RegistryCommunityTestScenarioOptions & {
    backend?: CommunityStoryBackend;
  } = {},
): Promise<RegistryCommunityStoryRuntime> {
  const configured = storybookConfiguration();
  const backend = options.backend ?? configured.backend;
  if (backend === "memory") {
    const relayFactory = createInMemoryRelayFactory();
    const scenario = createRegistryCommunityTestScenario(options);
    await scenario.seed(relayFactory.relay(scenario.relayUrl));
    const dataSource = createRegistryCommunityDataSource({ relayFactory });
    return runtime(
      backend,
      relayFactory,
      scenario,
      dataSource,
      scenario.identity,
      relayFactory,
    );
  }

  const relayUrl = options.relayUrl ?? configured.relayUrl;
  if (relayUrl === undefined || relayUrl === "") {
    throw new Error(
      `${backend === "live" ? "Live" : "Docker"} relay unavailable. Provide the matching Storybook relay URL.`,
    );
  }
  const scenario = createRegistryCommunityTestScenario({
    ...options,
    relayUrl,
    ...(backend === "docker"
      ? { namespace: options.namespace ?? crypto.randomUUID() }
      : {}),
  });
  const relayFactory = createWebSocketCommunityRelayFactory();
  if (backend === "docker") {
    await seedRegistryCommunityTestScenario(scenario, relayFactory);
  }
  const dataSource = createRegistryCommunityDataSource({ relayFactory });
  return runtime(
    backend,
    relayFactory,
    scenario,
    dataSource,
    backend === "live" ? undefined : scenario.identity,
  );
}

function runtime(
  backend: CommunityStoryBackend,
  relayFactory: CommunityRelayFactory,
  scenario: RegistryCommunityTestScenario,
  dataSource: RegistryCommunityDataSource,
  identity?: RegistrySigner,
  inMemoryFactory?: InMemoryCommunityRelayFactory,
): RegistryCommunityStoryRuntime {
  return {
    backend,
    relayFactory,
    scenario,
    dataSource,
    ...(identity === undefined ? {} : { identity }),
    dispose() {
      dataSource.close();
      inMemoryFactory?.reset();
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
  };
}

function publicKey(secretKey: Uint8Array): string {
  return finalizeEvent(
    { kind: 0, created_at: 0, content: "", tags: [] },
    secretKey,
  ).pubkey;
}

function normalizeNamespace(namespace: string): string {
  return namespace
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}
