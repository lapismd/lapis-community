import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  createNip29CuratorDecisionTemplate,
  createNip29PublisherAuthorizationTemplate,
  createNip29ReleaseMessageTemplate,
} from "./nip29.js";
import { verifyNostrReleaseProof } from "./release-proof.js";

const encoder = new TextEncoder();

function digest(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

describe("portable Nostr release proofs", () => {
  it("verifies the same curator, publisher, manifest, and payload chain offline", () => {
    const curatorKey = generateSecretKey();
    const publisherKey = generateSecretKey();
    const curator = getPublicKey(curatorKey);
    const publisher = getPublicKey(publisherKey);
    const payload = encoder.encode("deterministic plugin payload");
    const manifestContent = JSON.stringify({
      schema: "lapis.registry.nip29-release/1",
      plugin: {
        schema: "lapis.registry.plugin/1",
        pluginId: "demo",
        name: "Demo",
        description: "Portable proof fixture",
        channel: "community",
        status: "active",
        index: { author: "Demo Publisher" },
        detail: {},
      },
      release: {
        schema: "lapis.registry.release/1",
        pluginId: "demo",
        version: "1.0.0",
        minAppVersion: "0.1.0",
        platforms: ["web"],
        releasedAt: "2026-09-05T00:00:00.000Z",
        artifact: {
          url: "https://assets.example/demo.payload.zip",
          sha256: digest(payload),
          size: payload.byteLength,
        },
        metadata: {},
      },
    });
    const manifestBytes = encoder.encode(manifestContent);
    const authorizationEvent = finalizeEvent(
      createNip29PublisherAuthorizationTemplate(
        "demo",
        publisher,
        "authorized",
        1,
      ),
      curatorKey,
    );
    const releaseEvent = finalizeEvent(
      createNip29ReleaseMessageTemplate(
        "demo",
        {
          url: "https://assets.example/demo.manifest.json",
          mimeType: "application/json",
          sha256: digest(manifestBytes),
          size: manifestBytes.byteLength,
        },
        2,
        "Demo 1.0.0",
      ),
      publisherKey,
    );
    const decisionEvent = finalizeEvent(
      createNip29CuratorDecisionTemplate(releaseEvent.id, "approved", 3),
      curatorKey,
    );
    const proof = {
      schema: "lapis.plugin.release-proof/1",
      authorizationEvent,
      releaseEvent,
      decisionEvent,
      manifest: {
        sha256: digest(manifestBytes),
        size: manifestBytes.byteLength,
        content: manifestContent,
      },
    };

    expect(
      verifyNostrReleaseProof(proof, {
        artifact: payload,
        trustedCuratorPubkeys: new Set([curator]),
      }),
    ).toMatchObject({
      pluginId: "demo",
      version: "1.0.0",
      requiresRelayRefresh: true,
    });

    expect(() =>
      verifyNostrReleaseProof(proof, {
        artifact: encoder.encode("tampered"),
        trustedCuratorPubkeys: new Set([curator]),
      }),
    ).toThrowError("Plugin artifact bytes do not match the curated release manifest");
  });
});
