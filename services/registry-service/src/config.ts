import {
  createCommunityKindMap,
  createRegistryKindMap,
  createSecurityKindMap,
  TEST_COMMUNITY_KINDS,
  TEST_REGISTRY_KINDS,
  TEST_SECURITY_KINDS,
} from "@lapismd/registry-protocol";
import type {
  CommunityKindMap,
  JsonObject,
  RegistryAuthorities,
  RegistryKindMap,
  SecurityAuthorities,
  SecurityKindMap,
} from "@lapismd/registry-protocol";

export interface RegistryServiceConfig {
  publicBaseUrl: string;
  requireHttpAuth: boolean;
  consoleOrigins: ReadonlySet<string>;
  kinds: RegistryKindMap;
  authorities: RegistryAuthorities;
  communityKinds: CommunityKindMap;
  securityKinds: SecurityKindMap;
  securityAuthorities: SecurityAuthorities;
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

function requiredKind(env: NodeJS.ProcessEnv, name: string): number {
  const raw = env[name];
  if (raw === undefined) {
    throw new Error(
      `${name} is required until workflow kinds are standardized`,
    );
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function protocolKinds(env: NodeJS.ProcessEnv): {
  community: CommunityKindMap;
  registry: RegistryKindMap;
  security: SecurityKindMap;
} {
  if (env.REGISTRY_USE_TEST_KINDS === "true") {
    if (env.NODE_ENV === "production") {
      throw new Error("Fixture registry kinds are forbidden in production");
    }
    return {
      community: TEST_COMMUNITY_KINDS,
      registry: TEST_REGISTRY_KINDS,
      security: TEST_SECURITY_KINDS,
    };
  }

  const registry = createRegistryKindMap({
    approval: requiredKind(env, "REGISTRY_APPROVAL_KIND"),
    moderationDecision: requiredKind(env, "REGISTRY_MODERATION_DECISION_KIND"),
    revocation: requiredKind(env, "REGISTRY_REVOCATION_KIND"),
    snapshot: requiredKind(env, "REGISTRY_SNAPSHOT_KIND"),
  });
  const community = createCommunityKindMap({
    rating: requiredKind(env, "REGISTRY_RATING_KIND"),
    comment: registry.comment,
    report: registry.moderationReport,
    followList: 3,
    appCurationSet: 30267,
    softwareApplication: registry.softwareApplication,
  });
  const security = createSecurityKindMap({
    advisory: requiredKind(env, "REGISTRY_SECURITY_ADVISORY_KIND"),
    disposition: requiredKind(env, "REGISTRY_SECURITY_DISPOSITION_KIND"),
  });
  const customKinds = [
    ["approval", registry.approval],
    ["moderation decision", registry.moderationDecision],
    ["revocation", registry.revocation],
    ["snapshot", registry.snapshot],
    ["rating", community.rating],
    ["security advisory", security.advisory],
    ["security disposition", security.disposition],
  ] as const;
  const byKind = new Map<number, string>();
  for (const [name, kind] of customKinds) {
    const existing = byKind.get(kind);
    if (existing !== undefined) {
      throw new Error(`${name} kind collides with ${existing} kind`);
    }
    byKind.set(kind, name);
  }
  for (const [name, kind] of customKinds) {
    const standard = Object.entries(registry).find(
      ([key, value]) =>
        [
          "softwareApplication",
          "releaseArtifactSet",
          "assessmentLabel",
          "moderationReport",
          "fileMetadata",
          "comment",
        ].includes(key) && value === kind,
    );
    if (standard !== undefined) {
      throw new Error(
        `${name} kind collides with standard ${standard[0]} kind`,
      );
    }
  }
  return { community, registry, security };
}

function securityAuthorities(env: NodeJS.ProcessEnv): SecurityAuthorities {
  return {
    advisoryPubkeys: pubkeys(
      env.REGISTRY_SECURITY_ADVISORY_PUBKEYS,
      "security advisory authorities",
    ),
    dispositionPubkeys: pubkeys(
      env.REGISTRY_SECURITY_DISPOSITION_PUBKEYS,
      "security disposition authorities",
    ),
  };
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
  const kinds = protocolKinds(env);
  return {
    publicBaseUrl,
    requireHttpAuth: env.REGISTRY_REQUIRE_HTTP_AUTH !== "false",
    consoleOrigins: origins(env.REGISTRY_CONSOLE_ORIGINS),
    kinds: kinds.registry,
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
    communityKinds: kinds.community,
    securityKinds: kinds.security,
    securityAuthorities: securityAuthorities(env),
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
