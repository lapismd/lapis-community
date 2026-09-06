import semver from "semver";
import { z } from "zod";

import type {
  CurrentNostrReleaseProof,
  JsonValue,
  LegacyNip29ReleaseManifest,
  LegacyNostrReleaseProof,
  LegacyReleaseContent,
  Nip29ReleaseManifest,
  Nip29RegistryHeadContent,
  Nip29PublisherAuthorizationContent,
  NostrReleaseProof,
  NostrEvent,
  PluginDefinitionContent,
  ReleaseContent,
  SequencedNip29ReleaseManifest,
  SequencedReleaseContent,
} from "./types.js";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/u);
const hex128 = z.string().regex(/^[0-9a-f]{128}$/u);
const pluginId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/u);
const timestamp = z.string().datetime({ offset: true });
const canonicalPositiveDecimal = z.string().regex(/^[1-9][0-9]*$/u);
const canonicalNonnegativeDecimal = z.string().regex(/^(?:0|[1-9][0-9]*)$/u);
const version = z
  .string()
  .max(128)
  .refine((value) => semver.valid(value) !== null, "Expected a SemVer version");

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

export const nostrEventSchema: z.ZodType<NostrEvent> = z
  .object({
    id: hex64,
    pubkey: hex64,
    created_at: z.number().int().nonnegative(),
    kind: z.number().int().min(0).max(65535),
    tags: z.array(z.array(z.string())),
    content: z.string(),
    sig: hex128,
  })
  .strict();

export const pluginDefinitionContentSchema: z.ZodType<PluginDefinitionContent> =
  z
    .object({
      schema: z.literal("lapis.registry.plugin/1"),
      pluginId,
      name: z.string().min(1).max(200),
      description: z.string().min(1).max(2_000),
      channel: z.string().min(1).max(80),
      status: z.enum([
        "active",
        "deprecated",
        "disabled",
        "pending",
        "revoked",
      ]),
      index: jsonObjectSchema,
      detail: jsonObjectSchema,
    })
    .strict();

export const legacyReleaseContentSchema: z.ZodType<LegacyReleaseContent> = z
  .object({
    schema: z.literal("lapis.registry.release/1"),
    pluginId,
    version,
    minAppVersion: version,
    platforms: z.array(z.string().min(1).max(80)).min(1),
    releasedAt: timestamp,
    artifact: z
      .object({
        url: z.string().url(),
        downloadUrl: z.string().min(1).optional(),
        sha256: hex64,
        size: z.number().int().nonnegative(),
      })
      .strict(),
    metadata: jsonObjectSchema,
  })
  .strict();

export const sequencedReleaseContentSchema: z.ZodType<SequencedReleaseContent> =
  z
    .object({
      schema: z.literal("lapis.registry.release/2"),
      pluginId,
      version,
      releaseSequence: canonicalPositiveDecimal,
      previousReleaseEventId: hex64.optional(),
      minAppVersion: version,
      platforms: z.array(z.string().min(1).max(80)).min(1),
      releasedAt: timestamp,
      artifact: z
        .object({
          url: z.string().url(),
          downloadUrl: z.string().min(1).optional(),
          sha256: hex64,
          size: z.number().int().nonnegative(),
        })
        .strict(),
      metadata: jsonObjectSchema,
    })
    .strict();

export const releaseContentSchema: z.ZodType<ReleaseContent> = z.union([
  legacyReleaseContentSchema,
  sequencedReleaseContentSchema,
]);

export const legacyNip29ReleaseManifestSchema: z.ZodType<LegacyNip29ReleaseManifest> =
  z
    .object({
      schema: z.literal("lapis.registry.nip29-release/1"),
      plugin: pluginDefinitionContentSchema,
      release: legacyReleaseContentSchema,
    })
    .strict();

export const sequencedNip29ReleaseManifestSchema: z.ZodType<SequencedNip29ReleaseManifest> =
  z
    .object({
      schema: z.literal("lapis.registry.nip29-release/2"),
      plugin: pluginDefinitionContentSchema,
      release: sequencedReleaseContentSchema,
    })
    .strict();

export const nip29ReleaseManifestSchema: z.ZodType<Nip29ReleaseManifest> =
  z.union([
    legacyNip29ReleaseManifestSchema,
    sequencedNip29ReleaseManifestSchema,
  ]);

export const nip29RegistryHeadContentSchema: z.ZodType<Nip29RegistryHeadContent> =
  z
    .object({
      schema: z.literal("lapis.registry.plugin-head/1"),
      pluginId,
      authorityEpoch: z.string().min(1).max(128),
      headRevision: canonicalPositiveDecimal,
      previousHeadEventId: hex64.optional(),
      activeReleaseEventId: hex64.optional(),
      releases: z.array(
        z
          .object({
            releaseEventId: hex64,
            manifestSha256: hex64,
            version,
            releaseSequence: canonicalNonnegativeDecimal.optional(),
            state: z.enum(["approved", "rejected", "revoked", "withdrawn"]),
            decisionEventId: hex64,
          })
          .strict(),
      ),
      issuedAt: timestamp,
      validUntil: timestamp,
    })
    .strict();

export const legacyNostrReleaseProofSchema: z.ZodType<LegacyNostrReleaseProof> =
  z
    .object({
      schema: z.literal("lapis.plugin.release-proof/1"),
      authorizationEvent: nostrEventSchema,
      releaseEvent: nostrEventSchema,
      decisionEvent: nostrEventSchema,
      manifest: z
        .object({
          sha256: hex64,
          size: z.number().int().positive(),
          content: z.string().min(1),
        })
        .strict(),
    })
    .strict();

export const currentNostrReleaseProofSchema: z.ZodType<CurrentNostrReleaseProof> =
  z
    .object({
      schema: z.literal("lapis.plugin.release-proof/2"),
      authorizationEvent: nostrEventSchema,
      releaseEvent: nostrEventSchema,
      decisionEvent: nostrEventSchema,
      headEvent: nostrEventSchema,
      manifest: z
        .object({
          sha256: hex64,
          size: z.number().int().positive(),
          content: z.string().min(1),
        })
        .strict(),
    })
    .strict();

export const nostrReleaseProofSchema: z.ZodType<NostrReleaseProof> = z.union([
  legacyNostrReleaseProofSchema,
  currentNostrReleaseProofSchema,
]);

export const nip29PublisherAuthorizationContentSchema: z.ZodType<Nip29PublisherAuthorizationContent> =
  z
    .object({
      schema: z.literal("lapis.registry.publisher-authorization/1"),
      status: z.enum(["authorized", "revoked"]),
    })
    .strict();
