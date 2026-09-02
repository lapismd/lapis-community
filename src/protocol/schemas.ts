import semver from "semver";
import { z } from "zod";

import type {
  JsonValue,
  Nip29ReleaseManifest,
  NostrEvent,
  PluginDefinitionContent,
  ReleaseContent,
} from "./types.js";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/u);
const hex128 = z.string().regex(/^[0-9a-f]{128}$/u);
const pluginId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/u);
const timestamp = z.string().datetime({ offset: true });
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

export const releaseContentSchema: z.ZodType<ReleaseContent> = z
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

export const nip29ReleaseManifestSchema: z.ZodType<Nip29ReleaseManifest> = z
  .object({
    schema: z.literal("lapis.registry.nip29-release/1"),
    plugin: pluginDefinitionContentSchema,
    release: releaseContentSchema,
  })
  .strict();
