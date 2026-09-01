import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  createBuzzCuratorDecisionTemplate,
  createBuzzForumReplyTemplate,
  createBuzzForumRootTemplate,
  createBuzzReleaseMessageTemplate,
  LAPIS_BUZZ_GROUP_PATHS,
  lapisBuzzGroupId,
  lapisPluginSupportGroupId,
  materializeBuzzRegistry,
} from "@lapismd/registry-protocol";
import type {
  BuzzManifestAttachment,
  BuzzReleaseManifestSource,
  NostrEvent,
  NostrEventTemplate,
  ReleaseContent,
} from "@lapismd/registry-protocol";
import { WebSocketRegistryRelay } from "@lapismd/registry-nostr";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";

import { parseFixtureSecrets } from "./keys.js";
import type { FixtureSecretName, FixtureSecrets } from "./keys.js";
import { loadLocalPluginFixtures } from "./source.js";

interface FixtureStatus {
  schema: "lapis.registry.buzz-local-fixture-status/1";
  pluginCount: number;
  pluginIds: string[];
  registryEventCount: number;
  communityEventCount: number;
  registryRoot: string;
  relayCopies: number;
  groupIds: Record<string, string>;
}

interface BlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === "")
    throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? String(fallback));
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`${name} must be a positive integer`);
  return value;
}

function secret(secrets: FixtureSecrets, name: FixtureSecretName): Uint8Array {
  return hexToBytes(secrets.keys[name]);
}

function sign(secretKey: Uint8Array, template: NostrEventTemplate): NostrEvent {
  return finalizeEvent(template, secretKey);
}

function authSigner(secretKey: Uint8Array) {
  return async (template: NostrEventTemplate) => sign(secretKey, template);
}

async function retry<T>(action: () => Promise<T>, label: string): Promise<T> {
  let cause: unknown;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      cause = error;
      await delay(Math.min(250 * attempt, 2_000));
    }
  }
  throw new Error(`${label} failed`, { cause });
}

async function seed(): Promise<{
  artifacts: Map<string, Uint8Array>;
  catalog: unknown;
  status: FixtureStatus;
}> {
  const secrets = parseFixtureSecrets(
    JSON.parse(
      await readFile(required("REGISTRY_FIXTURE_SECRETS_FILE"), "utf8"),
    ),
  );
  const relayUrl = new URL(required("REGISTRY_BUZZ_RELAY")).toString();
  const httpBase = relayUrl
    .replace(/^ws:/u, "http:")
    .replace(/^wss:/u, "https:");
  const artifactBase = new URL(
    required("REGISTRY_FIXTURE_ARTIFACT_BASE_URL", "http://127.0.0.1:8090/"),
  );
  const pluginLimitRaw =
    process.env.REGISTRY_FIXTURE_PLUGIN_LIMIT?.trim() ?? "all";
  const fixtures = await loadLocalPluginFixtures(
    required("LAPIS_PLUGINS_ROOT", "/workspace/lapis-plugins"),
    {
      ...(pluginLimitRaw === "all" || pluginLimitRaw === ""
        ? {}
        : { limit: positiveInteger("REGISTRY_FIXTURE_PLUGIN_LIMIT", 12) }),
      publicBaseUrl: artifactBase,
    },
  );
  if (fixtures.length === 0)
    throw new Error("No complete plugin fixtures were found");

  const artifacts = new Map(
    fixtures.flatMap((fixture) => [
      [`/${fixture.artifact.path}`, fixture.artifact.bytes] as const,
      ...fixture.resources.map(
        (resource) => [`/${resource.path}`, resource.bytes] as const,
      ),
    ]),
  );
  const publisherSecret = secret(secrets, "publisher");
  const curatorSecret = secret(secrets, "curator");
  const operatorSecret = secret(secrets, "operator");
  const publisher = getPublicKey(publisherSecret);
  const curator = getPublicKey(curatorSecret);
  const relays = new Map<string, WebSocketRegistryRelay>();
  const relayFor = async (
    secretKey: Uint8Array,
  ): Promise<WebSocketRegistryRelay> => {
    const pubkey = getPublicKey(secretKey);
    let relay = relays.get(pubkey);
    if (relay === undefined) {
      relay = new WebSocketRegistryRelay(relayUrl, {
        authenticationRelayUrl: relayUrl,
        connectTimeoutMs: 15_000,
        eoseTimeoutMs: 15_000,
        publishTimeoutMs: 2_000,
      });
      await retry(
        async () => await relay!.authenticate(authSigner(secretKey)),
        `NIP-42 ${pubkey}`,
      );
      relays.set(pubkey, relay);
    }
    return relay;
  };
  const events: NostrEvent[] = [];
  const publish = async (
    event: NostrEvent,
    secretKey: Uint8Array,
  ): Promise<void> => {
    const relay = await relayFor(secretKey);
    await retry(async () => {
      try {
        await relay.publish(event);
      } catch (error) {
        const retained = await relay.query({ ids: [event.id] });
        if (!retained.some((copy) => copy.id === event.id)) throw error;
      }
    }, `publish ${event.id}`);
    events.push(event);
  };
  const createGroup = async (
    event: NostrEvent,
    groupId: string,
  ): Promise<void> => {
    const relay = await relayFor(operatorSecret);
    try {
      await relay.publish(event);
    } catch {
      // Buzz consumes NIP-29 management events into relay-signed group state;
      // some versions do not acknowledge or re-serve the original kind 9007.
    }
    await retry(async () => {
      const state = await relay.query({
        kinds: [39_000, 39_002],
        "#d": [groupId],
      });
      if (state.length < 2)
        throw new Error(`Buzz group ${groupId} is incomplete`);
    }, `create group ${groupId}`);
  };

  let createdAt = positiveInteger(
    "REGISTRY_FIXTURE_CREATED_AT",
    Math.floor(Date.now() / 1_000) - 300,
  );
  const baseGroups = [
    [LAPIS_BUZZ_GROUP_PATHS.pluginReleases, "plugin-releases", "stream"],
    [LAPIS_BUZZ_GROUP_PATHS.general, "general", "stream"],
    [LAPIS_BUZZ_GROUP_PATHS.pluginDevelopment, "plugin-development", "stream"],
    [LAPIS_BUZZ_GROUP_PATHS.forums, "forums", "forum"],
  ] as const;
  const groups = [
    ...baseGroups.map(([path, name, type]) => ({
      id: lapisBuzzGroupId(path),
      name,
      type,
    })),
    ...fixtures.map((fixture) => ({
      id: lapisPluginSupportGroupId(fixture.plugin.pluginId),
      name: `support-${fixture.plugin.pluginId}`,
      type: "forum" as const,
    })),
  ];
  for (const group of groups) {
    await createGroup(
      sign(operatorSecret, {
        kind: 9_007,
        created_at: createdAt++,
        content: "",
        tags: [
          ["h", group.id],
          ["name", group.name],
          ["visibility", "open"],
          ["channel_type", group.type],
        ],
      }),
      group.id,
    );
  }

  const registryEvents: NostrEvent[] = [];
  const manifests: BuzzReleaseManifestSource[] = [];
  const releaseByPlugin = new Map<string, NostrEvent>();
  for (const fixture of fixtures) {
    const release: ReleaseContent = {
      ...fixture.release,
      releasedAt: new Date(createdAt * 1_000).toISOString(),
      artifact: {
        url: new URL(fixture.artifact.path, artifactBase).toString(),
        sha256: fixture.artifact.sha256,
        size: fixture.artifact.bytes.byteLength,
      },
    };
    const bytes = new TextEncoder().encode(JSON.stringify(release));
    const descriptor = await uploadBlob(httpBase, bytes, publisherSecret);
    const attachment: BuzzManifestAttachment = {
      url: descriptor.url,
      mimeType: descriptor.type,
      sha256: descriptor.sha256,
      size: descriptor.size,
      filename: `${fixture.plugin.pluginId}-${release.version}.manifest.json`,
    };
    manifests.push({ attachmentSha256: descriptor.sha256, manifest: release });
    const submission = sign(
      publisherSecret,
      createBuzzReleaseMessageTemplate(
        fixture.plugin.pluginId,
        attachment,
        createdAt++,
        `${fixture.plugin.name} ${release.version} is ready for curator review.`,
      ),
    );
    const approval = sign(
      curatorSecret,
      createBuzzCuratorDecisionTemplate(submission.id, "approved", createdAt++),
    );
    await publish(submission, publisherSecret);
    await publish(approval, curatorSecret);
    registryEvents.push(submission, approval);
    releaseByPlugin.set(fixture.plugin.pluginId, submission);
  }

  const forumId = lapisPluginSupportGroupId("ai");
  const communitySecrets = [
    secret(secrets, "communityOne"),
    secret(secrets, "communityTwo"),
  ];
  const communityEvents: NostrEvent[] = [];
  const profileNames = [
    ["maya", "Maya Chen"],
    ["owen_local", "Owen"],
  ] as const;
  for (const [index, secretKey] of communitySecrets.entries()) {
    const [name, displayName] = profileNames[index]!;
    const profile = sign(secretKey, {
      kind: 0,
      created_at: createdAt++,
      tags: [],
      content: JSON.stringify({
        name,
        display_name: displayName,
        about: "Local Lapis registry demo participant",
      }),
    });
    await publish(profile, secretKey);
    communityEvents.push(profile);
  }
  const topicTitles = [
    "How should AI provider fallback behave?",
    "What belongs in the plugin release checklist?",
    "Ideas for the next Lapis community call",
  ];
  for (const [topicIndex, title] of topicTitles.entries()) {
    const rootSecret = communitySecrets[topicIndex % communitySecrets.length]!;
    const root = sign(
      rootSecret,
      createBuzzForumRootTemplate(forumId, title, createdAt++),
    );
    await publish(root, rootSecret);
    communityEvents.push(root);
    const replyCount = topicIndex === 0 ? 48 : topicIndex === 1 ? 12 : 6;
    let previousReply: NostrEvent | undefined;
    for (let index = 0; index < replyCount; index += 1) {
      const authorSecret = communitySecrets[index % communitySecrets.length]!;
      const template = createBuzzForumReplyTemplate(
        forumId,
        root.id,
        `Reply ${index + 1}: ${discussionSentence(index)}`,
        createdAt++,
      );
      if (previousReply !== undefined && index % 5 === 0) {
        template.tags = [
          ["h", forumId],
          ["e", root.id, "", "root"],
          ["e", previousReply.id, "", "reply"],
        ];
      }
      const reply = sign(authorSecret, template);
      await publish(reply, authorSecret);
      communityEvents.push(reply);
      previousReply = reply;
      if (index % 3 === 0) {
        const reactionSecret =
          communitySecrets[(index + 1) % communitySecrets.length]!;
        const reaction = sign(reactionSecret, {
          kind: 7,
          created_at: createdAt++,
          content: index % 2 === 0 ? "👍" : "❤️",
          tags: [
            ["e", reply.id],
            ["p", reply.pubkey],
            ["k", reply.kind.toString()],
          ],
        });
        await publish(reaction, reactionSecret);
        communityEvents.push(reaction);
      }
    }
  }
  const aiRelease = releaseByPlugin.get("ai");
  if (aiRelease === undefined) {
    throw new Error("The local plugin fixtures must include the AI plugin");
  }
  for (const [index, [authorIndex, content]] of [
    [0, "👍"],
    [1, "❤️"],
    [0, "⭐"],
  ].entries()) {
    const authorSecret = communitySecrets[Number(authorIndex)]!;
    const reaction = sign(authorSecret, {
      kind: 7,
      created_at: createdAt + index,
      content: String(content),
      tags: [
        ["e", aiRelease.id],
        ["p", aiRelease.pubkey],
        ["k", aiRelease.kind.toString()],
      ],
    });
    await publish(reaction, authorSecret);
    communityEvents.push(reaction);
  }
  createdAt += 3;

  const registry = materializeBuzzRegistry(
    registryEvents,
    manifests,
    fixtures.map((fixture) => ({ content: fixture.plugin })),
    {
      curatorPubkeys: new Set([curator]),
      publisherPubkeysByPlugin: new Map(
        fixtures.map((fixture) => [
          fixture.plugin.pluginId,
          new Set([publisher]),
        ]),
      ),
    },
  );
  if (
    registry.plugins.length !== fixtures.length ||
    registry.issues.length !== 0
  ) {
    throw new Error(
      "Buzz fixture did not materialize the complete plugin catalog",
    );
  }
  const reader = await relayFor(publisherSecret);
  const retained = await reader.query({ ids: events.map((event) => event.id) });
  if (retained.length !== events.length) {
    throw new Error(
      `Buzz retained ${retained.length}/${events.length} fixture events`,
    );
  }
  for (const relay of relays.values()) relay.close();

  return {
    artifacts,
    catalog: fixtures.map((fixture) => ({ content: fixture.plugin })),
    status: {
      schema: "lapis.registry.buzz-local-fixture-status/1",
      pluginCount: fixtures.length,
      pluginIds: fixtures.map((fixture) => fixture.plugin.pluginId),
      registryEventCount: registryEvents.length,
      communityEventCount: communityEvents.length,
      registryRoot: registry.root,
      relayCopies: retained.length,
      groupIds: Object.fromEntries(
        groups.map((group) => [group.name, group.id]),
      ),
    },
  };
}

async function uploadBlob(
  httpBase: string,
  bytes: Uint8Array,
  secretKey: Uint8Array,
): Promise<BlobDescriptor> {
  const body = Uint8Array.from(bytes);
  const sha256 = bytesToHex(
    new Uint8Array(
      await globalThis.crypto.subtle.digest("SHA-256", body.buffer),
    ),
  );
  const now = Math.floor(Date.now() / 1_000);
  const auth = sign(secretKey, {
    kind: 24_242,
    created_at: now,
    content: "Upload Lapis release manifest",
    tags: [
      ["t", "upload"],
      ["x", sha256],
      ["expiration", String(now + 300)],
      ["server", new URL(httpBase).host],
    ],
  });
  const token = Buffer.from(JSON.stringify(auth)).toString("base64url");
  const response = await fetch(new URL("/upload", httpBase), {
    method: "PUT",
    headers: {
      Authorization: `Nostr ${token}`,
      "Content-Type": "application/json",
      "X-SHA-256": sha256,
    },
    body: Buffer.from(body),
  });
  if (!response.ok)
    throw new Error(`Buzz manifest upload returned ${response.status}`);
  return (await response.json()) as BlobDescriptor;
}

function discussionSentence(index: number): string {
  const sentences = [
    "Prefer an explicit ordered provider list with a visible fallback reason.",
    "The UI should keep enough context to make long-running support threads readable.",
    "A standard Nostr reply remains portable even when Buzz adds richer views.",
    "Pagination should preserve the reader's place when newer replies arrive.",
    "Curator trust and community moderation need to remain separate decisions.",
  ];
  return sentences[index % sentences.length]!;
}

function startServer(
  artifacts: ReadonlyMap<string, Uint8Array>,
  catalog: unknown,
  status: FixtureStatus,
): void {
  const port = positiveInteger("PORT", 8090);
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
    if (pathname === "/health") {
      response.writeHead(200, {
        "access-control-allow-origin": "*",
        "content-type": "application/json",
      });
      response.end(JSON.stringify({ status: "ok", seeded: true }));
      return;
    }
    if (pathname === "/status.json" || pathname === "/catalog.json") {
      response.writeHead(200, {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
        "content-type": "application/json",
      });
      response.end(
        JSON.stringify(pathname === "/status.json" ? status : catalog),
      );
      return;
    }
    const artifact = artifacts.get(pathname);
    if (artifact === undefined) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "content-length": String(artifact.byteLength),
      "content-type": "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    response.end(artifact);
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(
      `Seeded ${status.pluginCount} plugins and ${status.communityEventCount} Buzz community events.`,
    );
  });
}

const seeded = await seed();
startServer(seeded.artifacts, seeded.catalog, seeded.status);
