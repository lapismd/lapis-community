import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createHttpAuthTemplate,
  toNip98AuthorizationHeader,
} from "@lapismd/registry-auth";
import {
  createApprovalEventTemplate,
  createAssessmentEventTemplate,
  createPluginEventTemplate,
  createReleaseEventTemplate,
  TEST_REGISTRY_KINDS,
} from "@lapismd/registry-protocol";
import type {
  ApprovalContent,
  AssessmentContent,
  NostrEvent,
  PluginDefinitionContent,
  RegistryAuthorities,
  ReleaseContent,
} from "@lapismd/registry-protocol";

import { handleRegistryRequest } from "./app.js";
import type { RegistryServiceDependencies } from "./app.js";
import { MemoryAuthChallengeStore } from "./challenges.js";
import { MemoryRegistryEventStore } from "./event-store.js";

const publisherSecret = generateSecretKey();
const assessorSecret = generateSecretKey();
const curatorSecret = generateSecretKey();
const snapshotSecret = generateSecretKey();
const attackerSecret = generateSecretKey();

const publisher = getPublicKey(publisherSecret);
const assessor = getPublicKey(assessorSecret);
const curator = getPublicKey(curatorSecret);
const snapshotSigner = getPublicKey(snapshotSecret);
const fixedNow = new Date("2026-08-31T16:00:00.000Z");
const createdAt = Math.floor(fixedNow.getTime() / 1_000) - 10;

const authorities: RegistryAuthorities = {
  assessorPubkeys: new Set([assessor]),
  curatorPubkeys: new Set([curator]),
  moderatorPubkeys: new Set(),
  snapshotSignerPubkeys: new Set([snapshotSigner]),
  registryOperatorPubkeys: new Set([curator]),
  publisherPubkeysByPlugin: new Map([["demo", new Set([publisher])]]),
};

function registryFixture(): {
  approval: NostrEvent;
  assessment: NostrEvent;
  plugin: NostrEvent;
  release: NostrEvent;
} {
  const pluginContent: PluginDefinitionContent = {
    schema: "lapis.registry.plugin/1",
    pluginId: "demo",
    name: "Demo",
    description: "Registry service fixture",
    channel: "official",
    status: "active",
    index: {
      schemaVersion: 1,
      author: "Lapis",
      categories: ["fixture"],
    },
    detail: {
      schemaVersion: 1,
      author: "Lapis",
      owner: { name: "Lapis", verified: true },
    },
  };
  const plugin = finalizeEvent(
    createPluginEventTemplate(pluginContent, TEST_REGISTRY_KINDS, createdAt),
    publisherSecret,
  );
  const releaseContent: ReleaseContent = {
    schema: "lapis.registry.release/1",
    pluginId: "demo",
    version: "1.0.0",
    minAppVersion: "0.1.0",
    platforms: ["web"],
    releasedAt: "2026-08-31T15:00:00.000Z",
    artifact: {
      url: "https://example.test/demo.lapis-plugin",
      sha256: "ab".repeat(32),
      size: 100,
    },
    metadata: {},
  };
  const release = finalizeEvent(
    createReleaseEventTemplate(
      releaseContent,
      publisher,
      TEST_REGISTRY_KINDS,
      createdAt + 1,
    ),
    publisherSecret,
  );
  const assessmentContent: AssessmentContent = {
    schema: "lapis.registry.assessment/1",
    releaseEventId: release.id,
    artifactSha256: releaseContent.artifact.sha256,
    status: "pass",
    checks: [{ id: "fixture", status: "pass" }],
  };
  const assessment = finalizeEvent(
    createAssessmentEventTemplate(
      assessmentContent,
      TEST_REGISTRY_KINDS,
      createdAt + 2,
    ),
    assessorSecret,
  );
  const approvalContent: ApprovalContent = {
    schema: "lapis.registry.approval/1",
    pluginId: "demo",
    version: "1.0.0",
    releaseEventId: release.id,
    assessmentEventId: assessment.id,
    artifactSha256: releaseContent.artifact.sha256,
    decision: "approved",
  };
  const approval = finalizeEvent(
    createApprovalEventTemplate(
      approvalContent,
      TEST_REGISTRY_KINDS,
      createdAt + 3,
    ),
    curatorSecret,
  );
  return { plugin, release, assessment, approval };
}

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("registry service", () => {
  let dependencies: RegistryServiceDependencies;

  beforeEach(() => {
    dependencies = {
      config: {
        publicBaseUrl: "https://registry.test/",
        requireHttpAuth: true,
        consoleOrigins: new Set(["https://console.test"]),
        kinds: TEST_REGISTRY_KINDS,
        authorities,
        indexBase: {
          registries: {
            "lapis-official": { name: "Lapis", trustTier: "official" },
          },
        },
      },
      events: new MemoryRegistryEventStore(),
      challenges: new MemoryAuthChallengeStore(),
      now: () => fixedNow,
    };
  });

  async function authorizedSubmission(
    event: NostrEvent,
    secret: Uint8Array,
  ): Promise<{ header: string; rawBody: string; response: Response }> {
    const challengeResponse = await handleRegistryRequest(
      new Request("https://registry.test/auth/challenge"),
      dependencies,
    );
    const challenge = await responseJson(challengeResponse);
    const token = String(challenge.challenge);
    const rawBody = JSON.stringify({ event });
    const authEvent = finalizeEvent(
      createHttpAuthTemplate({
        url: "https://registry.test/events",
        method: "POST",
        body: rawBody,
        challenge: token,
        createdAt: Math.floor(fixedNow.getTime() / 1_000),
      }),
      secret,
    );
    const header = toNip98AuthorizationHeader(authEvent);
    const response = await handleRegistryRequest(
      new Request("https://registry.test/events", {
        method: "POST",
        headers: {
          authorization: header,
          "content-type": "application/json",
        },
        body: rawBody,
      }),
      dependencies,
    );
    return { header, rawBody, response };
  }

  async function seedCuratedRegistry(): Promise<void> {
    const events = registryFixture();
    for (const [event, secret] of [
      [events.plugin, publisherSecret],
      [events.release, publisherSecret],
      [events.assessment, assessorSecret],
      [events.approval, curatorSecret],
    ] as const) {
      const submitted = await authorizedSubmission(event, secret);
      expect(submitted.response.status).toBe(201);
    }
  }

  it("ingests exact-author events and exposes an explicitly unsigned preview", async () => {
    await seedCuratedRegistry();

    const indexResponse = await handleRegistryRequest(
      new Request("https://registry.test/preview/v1/index.json"),
      dependencies,
    );
    expect(indexResponse.status).toBe(200);
    expect(indexResponse.headers.get("x-lapis-registry-unsigned")).toBe("true");
    expect(indexResponse.headers.get("x-lapis-registry-root")).toMatch(
      /^[0-9a-f]{64}$/u,
    );
    expect(await responseJson(indexResponse)).toMatchObject({
      plugins: [{ id: "demo", latestVersion: "1.0.0" }],
    });

    const detailResponse = await handleRegistryRequest(
      new Request("https://registry.test/preview/v1/plugins/demo.json"),
      dependencies,
    );
    expect(await responseJson(detailResponse)).toMatchObject({
      id: "demo",
      versions: { "1.0.0": { bundle: { sha256: "ab".repeat(32) } } },
    });
  });

  it("allows only configured console origins", async () => {
    const allowed = await handleRegistryRequest(
      new Request("https://registry.test/preview/v1/index.json", {
        headers: { origin: "https://console.test" },
      }),
      dependencies,
    );
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://console.test",
    );
    expect(allowed.headers.get("access-control-expose-headers")).toContain(
      "x-lapis-registry-root",
    );

    const denied = await handleRegistryRequest(
      new Request("https://registry.test/events", {
        method: "OPTIONS",
        headers: { origin: "https://attacker.test" },
      }),
      dependencies,
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.has("access-control-allow-origin")).toBe(false);
  });

  it("consumes NIP-98 challenges once", async () => {
    const { plugin } = registryFixture();
    const first = await authorizedSubmission(plugin, publisherSecret);
    expect(first.response.status).toBe(201);

    const replay = await handleRegistryRequest(
      new Request("https://registry.test/events", {
        method: "POST",
        headers: { authorization: first.header },
        body: first.rawBody,
      }),
      dependencies,
    );
    expect(replay.status).toBe(401);
    expect(await responseJson(replay)).toMatchObject({
      error: { code: "challenge-invalid" },
    });
  });

  it("rejects unauthorized curation and accepts a matching snapshot signer", async () => {
    const fixture = registryFixture();
    const unauthorizedApproval = finalizeEvent(
      {
        kind: fixture.approval.kind,
        created_at: fixture.approval.created_at,
        tags: fixture.approval.tags,
        content: fixture.approval.content,
      },
      attackerSecret,
    );
    const rejected = await authorizedSubmission(
      unauthorizedApproval,
      attackerSecret,
    );
    expect(rejected.response.status).toBe(422);
    expect(await responseJson(rejected.response)).toMatchObject({
      error: { code: "event-authority" },
    });

    await seedCuratedRegistry();
    const templateResponse = await handleRegistryRequest(
      new Request("https://registry.test/preview/snapshot-template"),
      dependencies,
    );
    const templateBody = await responseJson(templateResponse);
    const snapshot = finalizeEvent(
      templateBody.template as Parameters<typeof finalizeEvent>[0],
      snapshotSecret,
    );
    const accepted = await authorizedSubmission(snapshot, snapshotSecret);
    expect(accepted.response.status).toBe(201);
  });
});
