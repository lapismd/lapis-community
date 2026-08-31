import {
  createRegistryKindMap,
  TEST_REGISTRY_KINDS,
} from "@lapismd/registry-protocol";
import type {
  JsonObject,
  RegistryAuthorities,
  RegistryKindMap,
} from "@lapismd/registry-protocol";

export interface RegistryServiceConfig {
  publicBaseUrl: string;
  requireHttpAuth: boolean;
  consoleOrigins: ReadonlySet<string>;
  kinds: RegistryKindMap;
  authorities: RegistryAuthorities;
  indexBase: JsonObject;
}

function origins(value: string | undefined): ReadonlySet<string> {
  const result = new Set<string>();
  for (const candidate of (value ?? "").split(",")) {
    const trimmed = candidate.trim();
    if (trimmed === "") continue;
    if (trimmed === "*") {
      throw new Error("REGISTRY_CONSOLE_ORIGINS cannot allow every origin");
    }
    result.add(new URL(trimmed).origin);
  }
  return result;
}

function pubkeys(value: string | undefined, name: string): ReadonlySet<string> {
  const result = new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  for (const pubkey of result) {
    if (!/^[0-9a-f]{64}$/u.test(pubkey)) {
      throw new Error(`${name} contains an invalid hex pubkey`);
    }
  }
  return result;
}

function workflowKinds(env: NodeJS.ProcessEnv): RegistryKindMap {
  if (env.REGISTRY_USE_TEST_KINDS === "true") {
    if (env.NODE_ENV === "production") {
      throw new Error("Fixture registry kinds are forbidden in production");
    }
    return TEST_REGISTRY_KINDS;
  }

  const value = (name: string): number => {
    const raw = env[name];
    if (raw === undefined) {
      throw new Error(
        `${name} is required until workflow kinds are standardized`,
      );
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed))
      throw new Error(`${name} must be an integer`);
    return parsed;
  };
  return createRegistryKindMap({
    approval: value("REGISTRY_APPROVAL_KIND"),
    moderationDecision: value("REGISTRY_MODERATION_DECISION_KIND"),
    revocation: value("REGISTRY_REVOCATION_KIND"),
    snapshot: value("REGISTRY_SNAPSHOT_KIND"),
  });
}

function publisherAllowlist(
  value: string | undefined,
): ReadonlyMap<string, ReadonlySet<string>> | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("REGISTRY_PUBLISHERS_JSON must be an object");
  }
  return new Map(
    Object.entries(parsed).map(([pluginId, candidates]) => {
      if (
        !Array.isArray(candidates) ||
        candidates.some(
          (candidate) =>
            typeof candidate !== "string" || !/^[0-9a-f]{64}$/u.test(candidate),
        )
      ) {
        throw new Error(`REGISTRY_PUBLISHERS_JSON.${pluginId} is invalid`);
      }
      return [pluginId, new Set(candidates)] as const;
    }),
  );
}

export function loadRegistryServiceConfig(
  env: NodeJS.ProcessEnv,
): RegistryServiceConfig {
  const publicBaseUrl = new URL(
    env.REGISTRY_PUBLIC_BASE_URL ?? "http://127.0.0.1:8787",
  ).toString();
  const publishers = publisherAllowlist(env.REGISTRY_PUBLISHERS_JSON);
  return {
    publicBaseUrl,
    requireHttpAuth: env.REGISTRY_REQUIRE_HTTP_AUTH !== "false",
    consoleOrigins: origins(env.REGISTRY_CONSOLE_ORIGINS),
    kinds: workflowKinds(env),
    authorities: {
      assessorPubkeys: pubkeys(env.REGISTRY_ASSESSOR_PUBKEYS, "assessors"),
      curatorPubkeys: pubkeys(env.REGISTRY_CURATOR_PUBKEYS, "curators"),
      moderatorPubkeys: pubkeys(env.REGISTRY_MODERATOR_PUBKEYS, "moderators"),
      snapshotSignerPubkeys: pubkeys(
        env.REGISTRY_SNAPSHOT_SIGNER_PUBKEYS,
        "snapshot signers",
      ),
      registryOperatorPubkeys: pubkeys(
        env.REGISTRY_OPERATOR_PUBKEYS,
        "registry operators",
      ),
      ...(publishers === undefined
        ? {}
        : { publisherPubkeysByPlugin: publishers }),
    },
    indexBase: {
      registries: {
        "lapis-official": {
          name: "Lapis Official Registry",
          trustTier: "official",
        },
      },
    },
  };
}
