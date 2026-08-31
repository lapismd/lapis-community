import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson } from "@lapismd/registry-protocol";
import type {
  JsonObject,
  PluginDefinitionContent,
  ReleaseContent,
} from "@lapismd/registry-protocol";
import semver from "semver";

const pluginIdPattern = /^[a-z0-9][a-z0-9-]{0,127}$/u;

export interface LocalPluginFixture {
  directory: string;
  plugin: PluginDefinitionContent;
  release: Omit<ReleaseContent, "artifact" | "releasedAt">;
  artifact: {
    path: string;
    bytes: Uint8Array;
    sha256: string;
  };
}

function object(value: unknown, label: string): JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonObject;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`${label} must be an array of strings`);
  }
  return [...value];
}

async function jsonFile(filePath: string): Promise<JsonObject> {
  return object(JSON.parse(await readFile(filePath, "utf8")), filePath);
}

function artifactBytes(input: {
  manifest: JsonObject;
  packageName: string;
  packageVersion: string;
  registry: JsonObject;
}): Uint8Array {
  return new TextEncoder().encode(
    `${canonicalJson({
      schema: "lapis.registry.local-source-fixture/1",
      manifest: input.manifest,
      package: {
        name: input.packageName,
        version: input.packageVersion,
      },
      registry: input.registry,
    })}\n`,
  );
}

export async function loadLocalPluginFixtures(
  lapisPluginsRoot: string,
  limit = 3,
): Promise<LocalPluginFixture[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Fixture plugin limit must be a positive integer");
  }
  const packagesRoot = path.join(lapisPluginsRoot, "packages");
  const directories = (await readdir(packagesRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
  const fixtures: LocalPluginFixture[] = [];

  for (const directory of directories) {
    if (fixtures.length >= limit) break;
    const packageRoot = path.join(packagesRoot, directory);
    let manifest: JsonObject;
    let packageJson: JsonObject;
    let registry: JsonObject;
    try {
      [manifest, packageJson, registry] = await Promise.all([
        jsonFile(path.join(packageRoot, "manifest.json")),
        jsonFile(path.join(packageRoot, "package.json")),
        jsonFile(path.join(packageRoot, "registry.json")),
      ]);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw cause;
    }

    const pluginId = text(manifest.id, `${directory} manifest id`);
    if (!pluginIdPattern.test(pluginId)) {
      throw new Error(`${directory} manifest id is not a registry plugin id`);
    }
    const packageName = text(packageJson.name, `${pluginId} package name`);
    const version = text(packageJson.version, `${directory} package version`);
    if (semver.valid(version) === null || manifest.version !== version) {
      throw new Error(
        `${pluginId} manifest and package versions must match SemVer`,
      );
    }
    const minAppVersion = text(
      manifest.minAppVersion,
      `${pluginId} minimum app version`,
    );
    if (semver.valid(minAppVersion) === null) {
      throw new Error(`${pluginId} minimum app version must be SemVer`);
    }
    const categories = stringArray(
      registry.categories,
      `${pluginId} categories`,
    );
    const highlights = stringArray(
      registry.highlights,
      `${pluginId} highlights`,
    );
    const bytes = artifactBytes({
      manifest,
      packageName,
      packageVersion: version,
      registry,
    });

    fixtures.push({
      directory,
      plugin: {
        schema: "lapis.registry.plugin/1",
        pluginId,
        name: text(manifest.name, `${pluginId} name`),
        description: text(manifest.description, `${pluginId} description`),
        channel: "official",
        status: "active",
        index: {
          schemaVersion: 1,
          author: text(manifest.author, `${pluginId} author`),
          categories,
          highlights,
          source: "lapis-plugins-local-fixture",
        },
        detail: {
          schemaVersion: 1,
          author: text(manifest.author, `${pluginId} author`),
          owner: {
            name: text(manifest.author, `${pluginId} author`),
            verified: true,
          },
          manifest,
          registry,
          sourceDirectory: `packages/${directory}`,
        },
      },
      release: {
        schema: "lapis.registry.release/1",
        pluginId,
        version,
        minAppVersion,
        platforms:
          manifest.isDesktopOnly === true ? ["desktop"] : ["web", "desktop"],
        metadata: {
          fixture: true,
          packageName,
          sourceDirectory: `packages/${directory}`,
        },
      },
      artifact: {
        path: `artifacts/${pluginId}/${version}/source-fixture.json`,
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    });
  }

  if (fixtures.length === 0) {
    throw new Error(`${lapisPluginsRoot} contains no complete plugin metadata`);
  }
  return fixtures;
}
