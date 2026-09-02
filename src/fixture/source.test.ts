import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { encodeNostrHttpAuthorization } from "../nostr/http-authorization.js";
import {
  createFixtureFiles,
  fixturePublicKeys,
  parseFixtureSecrets,
} from "./keys.js";
import { loadLocalPluginFixtures } from "./source.js";

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("local registry fixture", () => {
  it("uses standard base64 for Blossom authorization events", () => {
    const event = {
      id: "ff".repeat(32),
      pubkey: "ee".repeat(32),
      created_at: 1_700_000_000,
      kind: 24_242,
      tags: [["t", "upload"]],
      content: "Upload Lapis release manifest",
      sig: "dd".repeat(64),
    };
    const authorization = encodeNostrHttpAuthorization(event);
    const token = authorization.slice("Nostr ".length);

    expect(authorization).toMatch(/^Nostr /u);
    expect(token).toMatch(/^[A-Za-z0-9+/]+={0,2}$/u);
    expect(token).not.toMatch(/[-_]/u);
    expect(JSON.parse(Buffer.from(token, "base64").toString("utf8"))).toEqual(
      event,
    );
  });

  it("derives deterministic release evidence from a read-only plugin source", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lapis-registry-source-"));
    const pluginRoot = path.join(root, "packages", "wordcount");
    await mkdir(pluginRoot, { recursive: true });
    await writeJson(path.join(pluginRoot, "package.json"), {
      name: "@lapis-notes/wordcount",
      version: "0.1.2",
    });
    await writeJson(path.join(pluginRoot, "manifest.json"), {
      id: "wordcount",
      name: "Word Count",
      version: "0.1.2",
      minAppVersion: "0.1.0",
      description: "Counts words",
      author: "Lapis Notes",
      isDesktopOnly: false,
    });
    await writeJson(path.join(pluginRoot, "registry.json"), {
      schemaVersion: 1,
      categories: ["writing"],
      highlights: ["Counts words locally"],
    });

    const options = {
      limit: 1,
      publicBaseUrl: new URL("http://127.0.0.1:8090/"),
    };
    const first = await loadLocalPluginFixtures(root, options);
    const second = await loadLocalPluginFixtures(root, options);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      plugin: { pluginId: "wordcount", status: "active" },
      release: { version: "0.1.2", platforms: ["web", "electron"] },
    });
    expect(first[0]?.artifact.sha256).toBe(second[0]?.artifact.sha256);
    expect(new TextDecoder().decode(first[0]?.artifact.bytes)).toContain(
      "lapis.registry.local-source-fixture/1",
    );
  });

  it("keeps runtime secrets out of the public environment", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lapis-registry-keys-"));
    const files = await createFixtureFiles(root);
    const secrets = parseFixtureSecrets(
      JSON.parse(await readFile(files.secretsFile, "utf8")),
    );
    const publicKeys = fixturePublicKeys(secrets);
    const environment = await readFile(files.environmentFile, "utf8");
    const readerSecret = (
      await readFile(files.readerSecretFile, "utf8")
    ).trim();
    for (const secret of Object.values(secrets.keys)) {
      expect(environment).not.toContain(secret);
    }
    expect(environment).toContain(publicKeys.curator);
    expect(environment).toContain(publicKeys.publisher);
    expect(readerSecret).toBe(secrets.keys.communityOne);
    expect(environment).not.toContain(readerSecret);

    const repeated = await createFixtureFiles(root);
    expect(
      parseFixtureSecrets(
        JSON.parse(await readFile(repeated.secretsFile, "utf8")),
      ),
    ).toEqual(secrets);
  });
});
