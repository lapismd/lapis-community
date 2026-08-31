import { z } from "zod";
import semver from "semver";

import type {
  ApprovalContent,
  AssessmentContent,
  JsonValue,
  ModerationContent,
  NostrEvent,
  PluginDefinitionContent,
  ReleaseContent,
  RevocationContent,
  SnapshotContent,
} from "./types.js";

const hex64 = z.string().regex(/^[0-9a-f]{64}$/u);
const hex128 = z.string().regex(/^[0-9a-f]{128}$/u);
const pluginId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/u);
const sha256 = hex64;
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
      status: z.enum(["active", "deprecated", "disabled"]),
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
        sha256,
        size: z.number().int().nonnegative(),
      })
      .strict(),
    metadata: jsonObjectSchema,
  })
  .strict();

export const assessmentContentSchema: z.ZodType<AssessmentContent> = z
  .object({
    schema: z.literal("lapis.registry.assessment/1"),
    releaseEventId: hex64,
    artifactSha256: sha256,
    status: z.enum(["pass", "fail"]),
    checks: z.array(
      z
        .object({
          id: z.string().min(1).max(160),
          status: z.enum(["pass", "fail", "warn"]),
          message: z.string().max(2_000).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const approvalContentSchema: z.ZodType<ApprovalContent> = z
  .object({
    schema: z.literal("lapis.registry.approval/1"),
    pluginId,
    version,
    releaseEventId: hex64,
    assessmentEventId: hex64,
    artifactSha256: sha256,
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().max(2_000).optional(),
  })
  .strict();

const revocationTargetSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("artifact"), sha256 }).strict(),
  z.object({ scope: z.literal("plugin"), pluginId }).strict(),
  z.object({ scope: z.literal("publisher"), pubkey: hex64 }).strict(),
  z.object({ scope: z.literal("release"), releaseEventId: hex64 }).strict(),
]);

export const revocationContentSchema: z.ZodType<RevocationContent> = z
  .object({
    schema: z.literal("lapis.registry.revocation/1"),
    target: revocationTargetSchema,
    reason: z.string().min(1).max(2_000),
  })
  .strict();

const moderationTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("event"), eventId: hex64 }).strict(),
  z.object({ type: z.literal("plugin"), pluginId }).strict(),
  z.object({ type: z.literal("publisher"), pubkey: hex64 }).strict(),
]);

export const moderationContentSchema: z.ZodType<ModerationContent> = z
  .object({
    schema: z.literal("lapis.registry.moderation/1"),
    target: moderationTargetSchema,
    action: z.enum(["allow", "hide", "mute"]),
    reason: z.string().min(1).max(2_000),
  })
  .strict();

export const snapshotContentSchema: z.ZodType<SnapshotContent> = z
  .object({
    schema: z.literal("lapis.registry.snapshot/1"),
    root: sha256,
    eventIds: z.array(hex64),
    pluginCount: z.number().int().nonnegative(),
    excludedEventCount: z.number().int().nonnegative(),
    generatedAt: timestamp,
  })
  .strict();

export function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}
