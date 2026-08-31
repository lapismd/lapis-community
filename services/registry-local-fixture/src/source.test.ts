import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

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

    const first = await loadLocalPluginFixtures(root, 1);
    const second = await loadLocalPluginFixtures(root, 1);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      plugin: { pluginId: "wordcount", status: "active" },
      release: { version: "0.1.2", platforms: ["web", "desktop"] },
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
    for (const secret of Object.values(secrets.keys)) {
      expect(environment).not.toContain(secret);
    }
    expect(environment).toContain(publicKeys.assessor);
    expect(environment).toContain(publicKeys.publisher);

    const repeated = await createFixtureFiles(root);
    expect(
      parseFixtureSecrets(
        JSON.parse(await readFile(repeated.secretsFile, "utf8")),
      ),
    ).toEqual(secrets);
  });
});
