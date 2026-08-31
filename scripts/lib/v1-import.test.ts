import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { canonicalJson } from "../../packages/registry-protocol/src/index.js";
import type { JsonObject } from "../../packages/registry-protocol/src/index.js";
import { importSignedV1 } from "./v1-import.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "lapis-v1-import-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "plugins"), { recursive: true });
  await mkdir(path.join(root, "trust"), { recursive: true });

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const keyId = "lapis-registry-test";
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  await writeFile(
    path.join(root, "trust/root.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      keys: [{ keyId, alg: "ed25519", publicKeyPem }],
      roles: { registry: [keyId], release: [] },
    })}\n`,
  );

  async function writeSigned(
    relativePath: string,
    value: JsonObject,
  ): Promise<void> {
    const sidecar = {
      keyId,
      alg: "ed25519",
      sig: signBytes(
        null,
        Buffer.from(canonicalJson(value)),
        privateKey,
      ).toString("base64"),
    };
    await writeFile(
      path.join(root, relativePath),
      `${JSON.stringify({ ...value, signatures: [sidecar] }, null, 2)}\n`,
    );
    await writeFile(
      path.join(root, relativePath.replace(/\.json$/u, ".sig")),
      `${JSON.stringify(sidecar)}\n`,
    );
  }

  const indexEntry = {
    schemaVersion: 1,
    id: "demo",
    name: "Demo",
    description: "Fixture plugin",
    author: "Lapis",
    channel: "official",
    status: "active",
    latestVersion: "1.0.0",
    minAppVersion: "0.1.0",
    platforms: ["web"],
    categories: ["fixture"],
    badges: ["verified"],
    owner: { name: "Lapis", verified: true },
    detail: "plugins/demo.json",
    contributes: {},
    latestRelease: {
      releasedAt: "2026-08-31T12:00:00.000Z",
      bundleSize: 100,
    },
  } satisfies JsonObject;
  await writeSigned("index.json", {
    schemaVersion: 1,
    generatedAt: "2026-08-31T12:00:00.000Z",
    registries: {
      "lapis-official": { name: "Lapis", trustTier: "official" },
    },
    plugins: [indexEntry],
  });
  await writeSigned("plugins/demo.json", {
    schemaVersion: 1,
    id: "demo",
    name: "Demo",
    description: "Fixture plugin",
    author: "Lapis",
    channel: "official",
    status: "active",
    owner: { name: "Lapis", verified: true },
    latestVersion: "1.0.0",
    versions: {
      "1.0.0": {
        version: "1.0.0",
        minAppVersion: "0.1.0",
        platforms: ["web"],
        releasedAt: "2026-08-31T12:00:00.000Z",
        bundle: {
          url: "https://example.test/demo.lapis-plugin",
          sha256: "ab".repeat(32),
          size: 100,
        },
      },
    },
  });
  await writeSigned("revoked.json", {
    schemaVersion: 1,
    generatedAt: "2026-08-31T12:00:00.000Z",
    revoked: [],
  });
  return root;
}

describe("signed V1 import", () => {
  it("verifies metadata and round-trips through protocol records", async () => {
    const root = await fixture();
    const imported = await importSignedV1(root);

    expect(imported.report).toMatchObject({
      parity: true,
      pluginCount: 1,
      releaseCount: 1,
      verifiedSignatureCount: 3,
      mismatches: [],
    });
    expect(imported.report.projectedSemanticRoot).toBe(
      imported.report.sourceSemanticRoot,
    );
    expect(imported.plan.records[0]?.releases[0]?.artifact.sha256).toBe(
      "ab".repeat(32),
    );
  });

  it("fails closed when signed metadata is changed", async () => {
    const root = await fixture();
    const indexPath = path.join(root, "index.json");
    const index = JSON.parse(
      await (await import("node:fs/promises")).readFile(indexPath, "utf8"),
    ) as JsonObject;
    const plugins = index.plugins as JsonObject[];
    plugins[0] = { ...plugins[0], name: "Tampered" };
    await writeFile(indexPath, `${JSON.stringify(index)}\n`);

    await expect(importSignedV1(root)).rejects.toThrow(
      "index.json signature is invalid",
    );
  });
});
