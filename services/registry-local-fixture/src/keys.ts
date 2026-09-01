import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

const secretNames = [
  "communityOne",
  "communityTwo",
  "curator",
  "operator",
  "publisher",
] as const;

export type FixtureSecretName = (typeof secretNames)[number];

export interface FixtureSecrets {
  schema: "lapis.registry.local-fixture-secrets/1";
  keys: Record<FixtureSecretName, string>;
}

export interface FixtureFileSet {
  environmentFile: string;
  readerSecretFile: string;
  secretsFile: string;
}

function newSecrets(): FixtureSecrets {
  return {
    schema: "lapis.registry.local-fixture-secrets/1",
    keys: Object.fromEntries(
      secretNames.map((name) => [name, bytesToHex(generateSecretKey())]),
    ) as Record<FixtureSecretName, string>,
  };
}

export function parseFixtureSecrets(value: unknown): FixtureSecrets {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Fixture secrets must be an object");
  }
  const candidate = value as Partial<FixtureSecrets>;
  if (
    candidate.schema !== "lapis.registry.local-fixture-secrets/1" ||
    candidate.keys === undefined
  ) {
    throw new Error("Fixture secrets schema is invalid");
  }
  for (const name of secretNames) {
    const secret = candidate.keys[name];
    if (typeof secret !== "string" || !/^[0-9a-f]{64}$/u.test(secret)) {
      throw new Error(`Fixture ${name} secret is invalid`);
    }
  }
  return candidate as FixtureSecrets;
}

export function fixturePublicKeys(
  secrets: FixtureSecrets,
): Record<FixtureSecretName, string> {
  return Object.fromEntries(
    secretNames.map((name) => [
      name,
      getPublicKey(hexToBytes(secrets.keys[name])),
    ]),
  ) as Record<FixtureSecretName, string>;
}

async function existingSecrets(
  filePath: string,
): Promise<FixtureSecrets | undefined> {
  try {
    return parseFixtureSecrets(JSON.parse(await readFile(filePath, "utf8")));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw cause;
  }
}

export async function createFixtureFiles(
  outputDirectory: string,
): Promise<FixtureFileSet> {
  const directory = path.resolve(outputDirectory);
  const secretsFile = path.join(directory, "fixture-secrets.json");
  const environmentFile = path.join(directory, "fixture.env");
  const readerSecretFile = path.join(directory, "materializer-reader.key");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const secrets = (await existingSecrets(secretsFile)) ?? newSecrets();
  const publicKeys = fixturePublicKeys(secrets);
  const createdAt = Math.floor(Date.now() / 1_000) - 300;
  await writeFile(secretsFile, `${JSON.stringify(secrets, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(secretsFile, 0o600);
  await writeFile(readerSecretFile, `${secrets.keys.communityOne}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(readerSecretFile, 0o600);
  await writeFile(
    environmentFile,
    [
      `REGISTRY_CURATOR_PUBKEYS=${publicKeys.curator}`,
      `REGISTRY_PUBLISHER_PUBKEYS=${publicKeys.publisher}`,
      `REGISTRY_OPERATOR_PUBKEYS=${publicKeys.operator}`,
      `REGISTRY_READER_SECRET_FILE=${readerSecretFile}`,
      `REGISTRY_FIXTURE_CREATED_AT=${createdAt}`,
      `REGISTRY_FIXTURE_SECRETS_FILE=${secretsFile}`,
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 },
  );
  await chmod(environmentFile, 0o600);

  return { environmentFile, readerSecretFile, secretsFile };
}
