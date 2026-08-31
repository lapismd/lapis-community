import { createHash, createPublicKey, verify } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  canonicalHash,
  canonicalJson,
  projectV1Records,
} from "../../packages/registry-protocol/src/index.js";
import type {
  JsonObject,
  JsonValue,
  PluginDefinitionContent,
  ReleaseContent,
  V1ProjectionPlugin,
} from "../../packages/registry-protocol/src/index.js";

interface Signature {
  alg: string;
  keyId: string;
  sig: string;
}

interface VerificationEvidence {
  path: string;
  keyId: string;
  sha256: string;
}

export interface V1ImportPlan {
  schema: "lapis.registry.v1-import/1";
  sourceGeneratedAt: string;
  sourceTrustRootSha256: string;
  sourceFiles: VerificationEvidence[];
  records: V1ProjectionPlugin[];
  revoked: JsonObject;
}

export interface V1ParityReport {
  schema: "lapis.registry.v1-parity/1";
  parity: boolean;
  pluginCount: number;
  releaseCount: number;
  verifiedSignatureCount: number;
  sourceSemanticRoot: string;
  projectedSemanticRoot: string;
  mismatches: string[];
}

export interface ImportedV1 {
  plan: V1ImportPlan;
  report: V1ParityReport;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function object(value: unknown, label: string): JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonObject;
}

function string(value: JsonValue | undefined, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function strings(value: JsonValue | undefined, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value as string[];
}

function unsigned(value: JsonObject): JsonObject {
  const { signatures: _signatures, ...result } = value;
  return result;
}

function without(source: JsonObject, keys: readonly string[]): JsonObject {
  const omitted = new Set(keys);
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !omitted.has(key)),
  );
}

async function readJsonFile(filePath: string): Promise<{
  bytes: Uint8Array;
  value: JsonObject;
}> {
  const bytes = await readFile(filePath);
  return { bytes, value: object(JSON.parse(bytes.toString("utf8")), filePath) };
}

function signature(value: JsonObject, label: string): Signature {
  const candidate = object(value, label);
  const alg = string(candidate.alg, `${label}.alg`);
  const keyId = string(candidate.keyId, `${label}.keyId`);
  const sig = string(candidate.sig, `${label}.sig`);
  if (alg !== "ed25519") throw new Error(`${label} must use ed25519`);
  return { alg, keyId, sig };
}

function registryKeys(trustRoot: JsonObject): Map<string, string> {
  const roles = object(trustRoot.roles, "trust root roles");
  const registryRole = new Set(strings(roles.registry, "registry role"));
  if (!Array.isArray(trustRoot.keys)) {
    throw new Error("trust root keys must be an array");
  }

  const keys = new Map<string, string>();
  for (const candidate of trustRoot.keys) {
    const key = object(candidate, "trust root key");
    const keyId = string(key.keyId, "trust root key id");
    if (registryRole.has(keyId)) {
      keys.set(keyId, string(key.publicKeyPem, `${keyId} public key`));
    }
  }
  if (keys.size === 0) throw new Error("trust root has no registry role keys");
  return keys;
}

async function verifyMetadata(
  rootDir: string,
  relativePath: string,
  keys: ReadonlyMap<string, string>,
): Promise<{ evidence: VerificationEvidence; signed: JsonObject }> {
  const jsonPath = path.join(rootDir, relativePath);
  const sidecarPath = jsonPath.replace(/\.json$/u, ".sig");
  const [{ bytes, value }, sidecarFile] = await Promise.all([
    readJsonFile(jsonPath),
    readJsonFile(sidecarPath),
  ]);
  const sidecar = signature(sidecarFile.value, sidecarPath);
  const inline = Array.isArray(value.signatures)
    ? value.signatures
        .map((item) =>
          signature(object(item, `${jsonPath} signature`), jsonPath),
        )
        .find((item) => item.keyId === sidecar.keyId)
    : undefined;
  if (
    inline === undefined ||
    inline.alg !== sidecar.alg ||
    inline.sig !== sidecar.sig
  ) {
    throw new Error(`${relativePath} inline signature does not match sidecar`);
  }

  const publicKeyPem = keys.get(sidecar.keyId);
  if (publicKeyPem === undefined) {
    throw new Error(`${relativePath} is not signed by a registry role key`);
  }
  const signed = unsigned(value);
  const valid = verify(
    null,
    Buffer.from(canonicalJson(signed)),
    createPublicKey(publicKeyPem),
    Buffer.from(sidecar.sig, "base64"),
  );
  if (!valid) throw new Error(`${relativePath} signature is invalid`);

  return {
    signed,
    evidence: {
      path: relativePath,
      keyId: sidecar.keyId,
      sha256: sha256(bytes),
    },
  };
}

function pluginStatus(value: string): PluginDefinitionContent["status"] {
  if (
    value === "active" ||
    value === "deprecated" ||
    value === "disabled" ||
    value === "pending" ||
    value === "revoked"
  ) {
    return value;
  }
  throw new Error(`unsupported plugin status ${value}`);
}

function releaseContent(
  pluginId: string,
  versionName: string,
  input: JsonObject,
): ReleaseContent {
  const bundle = object(input.bundle, `${pluginId}@${versionName} bundle`);
  const size = bundle.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size < 0) {
    throw new Error(`${pluginId}@${versionName} bundle size is invalid`);
  }
  const downloadUrl = bundle.downloadUrl;
  if (downloadUrl !== undefined && typeof downloadUrl !== "string") {
    throw new Error(`${pluginId}@${versionName} download URL is invalid`);
  }

  return {
    schema: "lapis.registry.release/1",
    pluginId,
    version: string(input.version, `${pluginId} version`),
    minAppVersion: string(input.minAppVersion, `${pluginId} minAppVersion`),
    platforms: strings(input.platforms, `${pluginId} platforms`),
    releasedAt: string(input.releasedAt, `${pluginId} releasedAt`),
    artifact: {
      url: string(bundle.url, `${pluginId} bundle URL`),
      ...(downloadUrl === undefined ? {} : { downloadUrl }),
      sha256: string(bundle.sha256, `${pluginId} bundle sha256`),
      size,
    },
    metadata: without(input, [
      "bundle",
      "minAppVersion",
      "platforms",
      "releasedAt",
      "version",
    ]),
  };
}

function semanticRoot(
  index: JsonObject,
  plugins: ReadonlyMap<string, JsonObject>,
  revoked: JsonObject,
): string {
  return canonicalHash({
    index,
    plugins: Object.fromEntries([...plugins.entries()].toSorted()),
    revoked,
  });
}

export async function importSignedV1(rootDir: string): Promise<ImportedV1> {
  const trustRootFile = await readJsonFile(
    path.join(rootDir, "trust/root.json"),
  );
  const keys = registryKeys(trustRootFile.value);
  const sourceFiles: VerificationEvidence[] = [];
  const indexFile = await verifyMetadata(rootDir, "index.json", keys);
  const revokedFile = await verifyMetadata(rootDir, "revoked.json", keys);
  sourceFiles.push(indexFile.evidence, revokedFile.evidence);

  if (!Array.isArray(indexFile.signed.plugins)) {
    throw new Error("index plugins must be an array");
  }

  const records: V1ProjectionPlugin[] = [];
  const sourcePlugins = new Map<string, JsonObject>();
  for (const candidate of indexFile.signed.plugins) {
    const indexEntry = object(candidate, "index plugin");
    const pluginId = string(indexEntry.id, "plugin id");
    const detailPath = `plugins/${pluginId}.json`;
    const detailFile = await verifyMetadata(rootDir, detailPath, keys);
    sourceFiles.push(detailFile.evidence);
    sourcePlugins.set(pluginId, detailFile.signed);

    if (detailFile.signed.id !== pluginId) {
      throw new Error(`${detailPath} id does not match index`);
    }
    if (detailFile.signed.latestVersion !== indexEntry.latestVersion) {
      throw new Error(
        `${pluginId} latest version differs between index and detail`,
      );
    }
    const versions = object(detailFile.signed.versions, `${pluginId} versions`);
    const releases = Object.entries(versions)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([versionName, version]) =>
        releaseContent(
          pluginId,
          versionName,
          object(version, `${pluginId}@${versionName}`),
        ),
      );

    records.push({
      content: {
        schema: "lapis.registry.plugin/1",
        pluginId,
        name: string(detailFile.signed.name, `${pluginId} name`),
        description: string(
          detailFile.signed.description,
          `${pluginId} description`,
        ),
        channel: string(detailFile.signed.channel, `${pluginId} channel`),
        status: pluginStatus(
          string(detailFile.signed.status, `${pluginId} status`),
        ),
        index: indexEntry,
        detail: without(detailFile.signed, [
          "latestVersion",
          "signatures",
          "versions",
        ]),
      },
      releases,
      latestVersion: string(
        indexEntry.latestVersion,
        `${pluginId} latestVersion`,
      ),
    });
  }

  const generatedAt = string(indexFile.signed.generatedAt, "index generatedAt");
  const indexBase = without(indexFile.signed, [
    "generatedAt",
    "plugins",
    "schemaVersion",
    "signatures",
  ]);
  const projected = projectV1Records(
    records,
    { generatedAt, indexBase },
    {
      backend: "nostr",
      root: "import-parity",
      acceptedEventIds: [],
      exclusionCounts: {},
    },
  );

  const sourceRoot = semanticRoot(
    indexFile.signed,
    sourcePlugins,
    revokedFile.signed,
  );
  const projectedRoot = semanticRoot(
    projected.index,
    projected.plugins,
    revokedFile.signed,
  );
  const mismatches: string[] = [];
  if (canonicalJson(indexFile.signed) !== canonicalJson(projected.index)) {
    mismatches.push("index.json");
  }
  for (const [pluginId, detail] of sourcePlugins) {
    const projectedDetail = projected.plugins.get(pluginId);
    if (
      projectedDetail === undefined ||
      canonicalJson(detail) !== canonicalJson(projectedDetail)
    ) {
      mismatches.push(`plugins/${pluginId}.json`);
    }
  }

  sourceFiles.sort((left, right) => left.path.localeCompare(right.path));
  const plan: V1ImportPlan = {
    schema: "lapis.registry.v1-import/1",
    sourceGeneratedAt: generatedAt,
    sourceTrustRootSha256: sha256(trustRootFile.bytes),
    sourceFiles,
    records,
    revoked: revokedFile.signed,
  };
  return {
    plan,
    report: {
      schema: "lapis.registry.v1-parity/1",
      parity: mismatches.length === 0 && sourceRoot === projectedRoot,
      pluginCount: records.length,
      releaseCount: records.reduce(
        (total, record) => total + record.releases.length,
        0,
      ),
      verifiedSignatureCount: sourceFiles.length,
      sourceSemanticRoot: sourceRoot,
      projectedSemanticRoot: projectedRoot,
      mismatches,
    },
  };
}

export async function listUnexpectedPluginFiles(
  rootDir: string,
  importedPluginIds: ReadonlySet<string>,
): Promise<string[]> {
  const files = await readdir(path.join(rootDir, "plugins"));
  return files
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/u, ""))
    .filter((pluginId) => !importedPluginIds.has(pluginId))
    .toSorted();
}
