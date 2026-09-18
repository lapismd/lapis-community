import { generateSecretKey } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import { SecretKeyRegistrySigner } from "../auth/index.js";
import { createInMemoryRelayFactory } from "../testing/index.js";
import { createNip34ProjectForgeDataSource } from "./data-source.js";
import type { ProjectForgeRepositoryCapabilities } from "./model.js";
import {
  applySavedProtection,
  normalizeProtectionDocumentInput,
} from "./protection-document.js";

const owner = "1".repeat(64);
const repository = `30617:${owner}:notes`;

describe("protection document", () => {
  it("normalizes extra patterns and required approvals", () => {
    expect(
      normalizeProtectionDocumentInput({
        protected_patterns: ["release/*", "release/*"],
        required_approvals: 0,
        admin_bypass: true,
      }),
    ).toEqual({
      protected_patterns: ["refs/heads/release/*"],
      required_approvals: 1,
      admin_bypass: true,
    });
    expect(() =>
      normalizeProtectionDocumentInput({
        protected_patterns: ["*"],
        required_approvals: 1,
        admin_bypass: false,
      }),
    ).toThrow(/Invalid protected-ref pattern/u);
  });

  it("replaces only the saved repository protection document", () => {
    const current = {
      "30617:aa:notes": {
        merge: true,
        protection: { required_approvals: 1 },
      },
    } as unknown as Record<string, ProjectForgeRepositoryCapabilities>;
    const next = applySavedProtection(current, "30617:aa:notes", {
      required_approvals: 2,
      admin_bypass: true,
      document_patterns: ["refs/heads/release/*"],
    });
    expect(next["30617:aa:notes"]?.protection).toMatchObject({
      required_approvals: 2,
      admin_bypass: true,
    });
  });

  it("normalizes a named ruleset document", () => {
    expect(
      normalizeProtectionDocumentInput({
        version: 1,
        rules: [
          {
            id: "",
            name: "Release",
            enforcement: "active",
            targets: [{ type: "all" }],
            bypass: [{ kind: "maintainer" }],
            restrict_creations: false,
            restrict_updates: false,
            restrict_deletions: true,
            required_approvals: 2,
          },
        ],
      }),
    ).toMatchObject({
      version: 1,
      rules: [
        {
          id: "release",
          restrict_deletions: true,
          required_approvals: 2,
        },
      ],
    });
  });

  it("saves the relay-owned repository protection document", async () => {
    const requests: Array<{ url: string; method: string; body: string }> = [];
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = {
          url: input.toString(),
          method: init?.method ?? "GET",
          body: typeof init?.body === "string" ? init.body : "",
        };
        requests.push(request);
        if (!request.url.endsWith(`/${owner}/notes/protection`)) {
          return new Response("missing", { status: 404 });
        }
        return new Response(
          JSON.stringify({
            repository,
            protection: {
              document_patterns: ["refs/heads/release/*"],
              required_approvals: 2,
              admin_bypass: true,
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    );
    const session = await createNip34ProjectForgeDataSource({
      relayFactory: createInMemoryRelayFactory(),
      fetch,
      now: () => new Date("2026-09-10T12:00:00.000Z"),
    }).open({
      relayUrl: "wss://relay.example",
      identity: new SecretKeyRegistrySigner(generateSecretKey()),
    });
    await expect(
      session.updateRepositoryProtection(repository, {
        protected_patterns: ["release/*"],
        required_approvals: 2,
        admin_bypass: true,
      }),
    ).resolves.toMatchObject({
      document_patterns: ["refs/heads/release/*"],
      required_approvals: 2,
      admin_bypass: true,
    });
    expect(requests).toEqual([
      {
        method: "PUT",
        url: `https://relay.example/api/forge/repositories/${owner}/notes/protection`,
        body: JSON.stringify({
          protected_patterns: ["refs/heads/release/*"],
          required_approvals: 2,
          admin_bypass: true,
        }),
      },
    ]);
    session.close();
  });
});
