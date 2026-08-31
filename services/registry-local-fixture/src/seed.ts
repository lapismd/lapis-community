import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

import {
  loadRelayRegistryState,
  resolveExactEvents,
  WebSocketRegistryRelay,
} from "@lapismd/registry-nostr";
import {
  createApprovalEventTemplate,
  createAssessmentEventTemplate,
  createPluginEventTemplate,
  createRatingTemplate,
  createReleaseEventTemplate,
  createSnapshotContent,
  createSnapshotEventTemplate,
  createSecurityAdvisoryTemplate,
  createSecurityDispositionTemplate,
  eventAddress,
  materializeRegistry,
  TEST_COMMUNITY_KINDS,
  TEST_REGISTRY_KINDS,
  TEST_SECURITY_KINDS,
} from "@lapismd/registry-protocol";
import type {
  ApprovalContent,
  AssessmentContent,
  NostrEvent,
  RatingContent,
  RegistryAuthorities,
  ReleaseContent,
  SecurityAdvisoryContent,
  SecurityDispositionContent,
} from "@lapismd/registry-protocol";
import { hexToBytes } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";

import { parseFixtureSecrets } from "./keys.js";
import type { FixtureSecretName, FixtureSecrets } from "./keys.js";
import { publishWithRetainedQuorum } from "./publication.js";
import { loadLocalPluginFixtures } from "./source.js";

interface FixtureStatus {
  schema: "lapis.registry.local-fixture-status/1";
  pluginCount: number;
  pluginIds: string[];
  officialEventCount: number;
  communityEventCount: number;
  registryRoot: string;
  communityRoot: string;
  securityRoot: string;
  artifactPaths: string[];
  relayCopies: {
    official: Record<string, number>;
    officialQuorum: number;
    community: number;
  };
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? String(fallback));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function secret(secrets: FixtureSecrets, name: FixtureSecretName): Uint8Array {
  return hexToBytes(secrets.keys[name]);
}

async function retry<T>(action: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      await delay(Math.min(attempt * 250, 2_000));
    }
  }
  throw new Error(`${label} failed`, { cause: lastError });
}

async function seed(): Promise<{
  artifacts: Map<string, Uint8Array>;
  status: FixtureStatus;
}> {
  const secrets = parseFixtureSecrets(
    JSON.parse(
      await readFile(required("REGISTRY_FIXTURE_SECRETS_FILE"), "utf8"),
    ),
  );
  const lapisPluginsRoot = required(
    "LAPIS_PLUGINS_ROOT",
    "/workspace/lapis-plugins",
  );
  const pluginLimit = positiveInteger("REGISTRY_FIXTURE_PLUGIN_LIMIT", 3);
  const artifactBase = new URL(
    required("REGISTRY_FIXTURE_ARTIFACT_BASE_URL", "http://127.0.0.1:8090/"),
  );
  const officialUrls = required("REGISTRY_OFFICIAL_RELAYS")
    .split(",")
    .map((value) => new URL(value.trim()).toString());
  const publicationQuorum = positiveInteger("REGISTRY_PUBLISH_QUORUM", 1);
  if (publicationQuorum > officialUrls.length) {
    throw new Error("REGISTRY_PUBLISH_QUORUM exceeds the official relay set");
  }
  const communityUrl = new URL(required("REGISTRY_COMMUNITY_RELAY")).toString();
  const officialRelays = officialUrls.map(
    (url) => new WebSocketRegistryRelay(url, { connectTimeoutMs: 10_000 }),
  );
  const communityRelay = new WebSocketRegistryRelay(communityUrl, {
    connectTimeoutMs: 10_000,
  });
  const fixtures = await loadLocalPluginFixtures(lapisPluginsRoot, pluginLimit);
  const artifacts = new Map(
    fixtures.map((fixture) => [
      `/${fixture.artifact.path}`,
      fixture.artifact.bytes,
    ]),
  );
  const officialEvents: NostrEvent[] = [];
  const communityEvents: NostrEvent[] = [];
  // Stable identities make a container restart idempotent when a local relay
  // is still recovering. Users can override the epoch to create a fresh set.
  let createdAt = positiveInteger("REGISTRY_FIXTURE_CREATED_AT", 1_767_225_600);

  const publishOfficial = async (event: NostrEvent): Promise<void> => {
    await retry(async () => {
      try {
        return await publishWithRetainedQuorum(
          event,
          officialRelays,
          publicationQuorum,
        );
      } finally {
        for (const relay of officialRelays) relay.close();
      }
    }, `official publication ${event.id}`);
    officialEvents.push(event);
    await delay(125);
  };
  const publishCommunity = async (event: NostrEvent): Promise<void> => {
    await retry(async () => {
      try {
        return await communityRelay.publish(event);
      } finally {
        communityRelay.close();
      }
    }, `community publication ${event.id}`);
    communityEvents.push(event);
  };

  const publisherSecret = secret(secrets, "publisher");
  const publisher = getPublicKey(publisherSecret);
  const acceptedReleases: Array<{
    event: NostrEvent;
    content: ReleaseContent;
  }> = [];
  for (const fixture of fixtures) {
    const plugin = finalizeEvent(
      createPluginEventTemplate(
        fixture.plugin,
        TEST_REGISTRY_KINDS,
        createdAt++,
      ),
      publisherSecret,
    );
    const releaseContent: ReleaseContent = {
      ...fixture.release,
      releasedAt: new Date(createdAt * 1_000).toISOString(),
      artifact: {
        url: new URL(fixture.artifact.path, artifactBase).toString(),
        sha256: fixture.artifact.sha256,
        size: fixture.artifact.bytes.byteLength,
      },
    };
    const release = finalizeEvent(
      createReleaseEventTemplate(
        releaseContent,
        publisher,
        TEST_REGISTRY_KINDS,
        createdAt++,
      ),
      publisherSecret,
    );
    const assessmentContent: AssessmentContent = {
      schema: "lapis.registry.assessment/1",
      releaseEventId: release.id,
      artifactSha256: releaseContent.artifact.sha256,
      status: "pass",
      checks: [
        { id: "source-metadata", status: "pass" },
        { id: "manifest-version", status: "pass" },
      ],
    };
    const assessorSecret = secret(secrets, "assessor");
    const assessment = finalizeEvent(
      createAssessmentEventTemplate(
        assessmentContent,
        TEST_REGISTRY_KINDS,
        createdAt++,
      ),
      assessorSecret,
    );
    const approvalContent: ApprovalContent = {
      schema: "lapis.registry.approval/1",
      pluginId: fixture.plugin.pluginId,
      version: releaseContent.version,
      releaseEventId: release.id,
      assessmentEventId: assessment.id,
      artifactSha256: releaseContent.artifact.sha256,
      decision: "approved",
      reason: "Local read-only lapis-plugins fixture",
    };
    const curatorSecret = secret(secrets, "curator");
    const approval = finalizeEvent(
      createApprovalEventTemplate(
        approvalContent,
        TEST_REGISTRY_KINDS,
        createdAt++,
      ),
      curatorSecret,
    );

    await publishOfficial(plugin);
    await publishOfficial(release);
    await publishOfficial(assessment);
    await publishOfficial(approval);
    acceptedReleases.push({ event: release, content: releaseContent });
  }

  const firstFixture = fixtures[0]!;
  const firstRelease = acceptedReleases[0]!;
  const advisorySecret = secret(secrets, "advisory");
  const advisoryContent: SecurityAdvisoryContent = {
    schema: "lapis.registry.security-advisory/1",
    advisoryId: "LOCAL-FIXTURE-001",
    pluginId: firstFixture.plugin.pluginId,
    releaseEventId: firstRelease.event.id,
    artifactSha256: firstRelease.content.artifact.sha256,
    severity: "low",
    summary: "Local fixture advisory used to exercise the security projection",
  };
  const advisory = finalizeEvent(
    createSecurityAdvisoryTemplate(
      advisoryContent,
      TEST_SECURITY_KINDS,
      createdAt++,
    ),
    advisorySecret,
  );
  await publishOfficial(advisory);
  const dispositionSecret = secret(secrets, "disposition");
  const dispositionContent: SecurityDispositionContent = {
    schema: "lapis.registry.security-disposition/1",
    advisoryEventId: advisory.id,
    pluginId: advisoryContent.pluginId,
    releaseEventId: advisoryContent.releaseEventId,
    artifactSha256: advisoryContent.artifactSha256,
    action: "warn",
    reason: "Exercise an authorized exact-release warning locally",
  };
  const disposition = finalizeEvent(
    createSecurityDispositionTemplate(
      dispositionContent,
      TEST_SECURITY_KINDS,
      createdAt++,
    ),
    dispositionSecret,
  );
  await publishOfficial(disposition);

  const pluginAddress = eventAddress(
    TEST_REGISTRY_KINDS.softwareApplication,
    publisher,
    firstFixture.plugin.pluginId,
  );
  for (const [name, value] of [
    ["communityOne", 5],
    ["communityTwo", 4],
  ] as const) {
    const userSecret = secret(secrets, name);
    const ratingContent: RatingContent = {
      schema: "lapis.registry.rating/1",
      pluginId: firstFixture.plugin.pluginId,
      rating: value,
      status: "active",
      version: firstRelease.content.version,
    };
    await publishCommunity(
      finalizeEvent(
        createRatingTemplate(
          ratingContent,
          pluginAddress,
          TEST_COMMUNITY_KINDS,
          createdAt++,
        ),
        userSecret,
      ),
    );
  }
  const communityOneSecret = secret(secrets, "communityOne");
  const review = finalizeEvent(
    {
      kind: TEST_COMMUNITY_KINDS.comment,
      created_at: createdAt++,
      tags: [
        ["A", pluginAddress],
        ["K", String(TEST_COMMUNITY_KINDS.softwareApplication)],
        ["P", publisher],
        ["a", pluginAddress],
        ["k", String(TEST_COMMUNITY_KINDS.softwareApplication)],
        ["p", publisher],
      ],
      content: "Local fixture review generated from the mounted plugin source.",
    },
    communityOneSecret,
  );
  await publishCommunity(review);
  const communityTwoSecret = secret(secrets, "communityTwo");
  const report = finalizeEvent(
    {
      kind: TEST_COMMUNITY_KINDS.report,
      created_at: createdAt++,
      tags: [["p", publisher, "spam"]],
      content: "Local fixture report; it must not become security enforcement.",
    },
    communityTwoSecret,
  );
  await publishCommunity(report);
  const collection = finalizeEvent(
    {
      kind: TEST_COMMUNITY_KINDS.appCurationSet,
      created_at: createdAt++,
      tags: [
        ["d", "local-fixtures"],
        ["title", "Local fixture plugins"],
        ...fixtures.map((fixture) => [
          "a",
          eventAddress(
            TEST_REGISTRY_KINDS.softwareApplication,
            publisher,
            fixture.plugin.pluginId,
          ),
        ]),
      ],
      content: "Generated from the mounted lapis-plugins checkout.",
    },
    communityOneSecret,
  );
  await publishCommunity(collection);
  const follows = finalizeEvent(
    {
      kind: TEST_COMMUNITY_KINDS.followList,
      created_at: createdAt++,
      tags: [["p", publisher]],
      content: "",
    },
    communityTwoSecret,
  );
  await publishCommunity(follows);

  const snapshotSecret = secret(secrets, "snapshot");
  const authorities: RegistryAuthorities = {
    assessorPubkeys: new Set([getPublicKey(secret(secrets, "assessor"))]),
    curatorPubkeys: new Set([getPublicKey(secret(secrets, "curator"))]),
    moderatorPubkeys: new Set([getPublicKey(secret(secrets, "moderator"))]),
    snapshotSignerPubkeys: new Set([getPublicKey(snapshotSecret)]),
    registryOperatorPubkeys: new Set([
      getPublicKey(secret(secrets, "operator")),
    ]),
  };
  const resolvedForSnapshot = await resolveExactEvents(
    officialEvents.map((event) => event.id),
    officialRelays,
  );
  if (resolvedForSnapshot.missingEventIds.length > 0) {
    throw new Error(
      `Cannot snapshot ${resolvedForSnapshot.missingEventIds.length} missing relay events`,
    );
  }
  const liveRegistry = materializeRegistry(
    resolvedForSnapshot.events,
    TEST_REGISTRY_KINDS,
    authorities,
  );
  const snapshot = finalizeEvent(
    createSnapshotEventTemplate(
      createSnapshotContent(
        liveRegistry,
        new Date(createdAt * 1_000).toISOString(),
      ),
      TEST_REGISTRY_KINDS,
      createdAt++,
    ),
    snapshotSecret,
  );
  await publishOfficial(snapshot);

  const officialCopies: Record<string, number> = {};
  await Promise.all(
    officialRelays.map(async (relay) => {
      try {
        const events = await retry(async () => {
          try {
            return await relay.query({
              ids: officialEvents.map((event) => event.id),
            });
          } finally {
            relay.close();
          }
        }, `official relay verification ${relay.url}`);
        officialCopies[relay.url] = events.length;
      } catch {
        officialCopies[relay.url] = 0;
      }
    }),
  );
  const officialQuorum = Object.values(officialCopies).filter(
    (count) => count === officialEvents.length,
  ).length;
  if (officialQuorum < publicationQuorum) {
    throw new Error(
      `Only ${officialQuorum}/${officialUrls.length} official relays retained the complete event set`,
    );
  }
  const communityCopies = await retry(async () => {
    try {
      return await communityRelay.query({
        ids: communityEvents.map((event) => event.id),
      });
    } finally {
      communityRelay.close();
    }
  }, `community relay verification ${communityRelay.url}`);
  if (communityCopies.length !== communityEvents.length) {
    throw new Error(
      `${communityRelay.url} retained ${communityCopies.length}/${communityEvents.length} community events`,
    );
  }

  const relayState = await loadRelayRegistryState({
    officialRelays,
    communityRelays: [communityRelay],
    kinds: TEST_REGISTRY_KINDS,
    communityKinds: TEST_COMMUNITY_KINDS,
    securityKinds: TEST_SECURITY_KINDS,
    authorities,
    securityAuthorities: {
      advisoryPubkeys: new Set([getPublicKey(advisorySecret)]),
      dispositionPubkeys: new Set([getPublicKey(dispositionSecret)]),
    },
  });
  return {
    artifacts,
    status: {
      schema: "lapis.registry.local-fixture-status/1",
      pluginCount: fixtures.length,
      pluginIds: fixtures.map((fixture) => fixture.plugin.pluginId),
      officialEventCount: officialEvents.length,
      communityEventCount: communityEvents.length,
      registryRoot: relayState.registry.root,
      communityRoot: relayState.community.root,
      securityRoot: relayState.security.root,
      artifactPaths: [...artifacts.keys()].toSorted(),
      relayCopies: {
        official: officialCopies,
        officialQuorum,
        community: communityCopies.length,
      },
    },
  };
}

function startServer(
  artifacts: ReadonlyMap<string, Uint8Array>,
  status: FixtureStatus,
): void {
  const port = positiveInteger("PORT", 8090);
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://fixture").pathname;
    if (pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", seeded: true }));
      return;
    }
    if (pathname === "/status.json") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "application/json",
      });
      response.end(JSON.stringify(status));
      return;
    }
    const artifact = artifacts.get(pathname);
    if (artifact === undefined) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-length": String(artifact.byteLength),
      "content-type": "application/json",
      "x-content-type-options": "nosniff",
    });
    response.end(artifact);
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(
      `Seeded ${status.pluginCount} plugins, ${status.officialEventCount} official events, and ${status.communityEventCount} community events.`,
    );
    console.log(`Local fixture artifacts listening on port ${port}.`);
  });
}

const seeded = await seed();
startServer(seeded.artifacts, seeded.status);
