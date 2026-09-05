import { z } from "zod";

import type { NostrReleaseProof } from "../protocol/index.js";

const nonEmptyString = z.string().min(1);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/u);

export const registryCatalogStatusSchema = z.enum([
  "active",
  "pending",
  "deprecated",
  "disabled",
  "revoked",
]);

export const registryImageReferenceSchema = z.object({
  url: nonEmptyString,
  sourceUrl: z.string().url(),
  sha256,
  size: z.number().int().nonnegative(),
  mediaType: z.enum(["image/png", "image/webp", "image/svg+xml"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const registryAppearanceSchema = z.object({
  icon: nonEmptyString,
  accent: nonEmptyString,
  logo: registryImageReferenceSchema.extend({ alt: z.string() }).optional(),
});

export const registryGalleryItemSchema = z.object({
  id: nonEmptyString,
  alt: nonEmptyString,
  images: z.object({
    preview: registryImageReferenceSchema,
    full: registryImageReferenceSchema,
    light: registryImageReferenceSchema,
    dark: registryImageReferenceSchema,
  }),
});

export const registryMediaItemSchema = z.object({
  alt: nonEmptyString,
  images: registryGalleryItemSchema.shape.images,
});

export const registryMarkdownReferenceSchema = z.object({
  url: nonEmptyString,
  sourceUrl: z.string().url(),
  sha256,
  size: z.number().int().nonnegative(),
  mediaType: z.literal("text/markdown"),
});

export const registryReleaseSchema = z.object({
  version: nonEmptyString,
  minAppVersion: nonEmptyString,
  releasedAt: z.string().datetime({ offset: true }),
  platforms: z.array(nonEmptyString).min(1),
  bundle: z.object({
    url: nonEmptyString,
    downloadUrl: nonEmptyString.optional(),
    sha256,
    size: z.number().int().nonnegative(),
    pending: z.boolean().optional(),
  }),
});

const registryOwnerSchema = z.object({
  name: nonEmptyString,
  verified: z.boolean(),
  url: z.string().url().optional(),
});

const registryContributionsSchema = z
  .object({
    editorViews: z
      .array(
        z.object({
          id: nonEmptyString,
          label: nonEmptyString.optional(),
          filenamePatterns: z.array(nonEmptyString),
        }),
      )
      .optional(),
  })
  .passthrough();

export const registryCatalogEntrySchema = z.object({
  schemaVersion: z.literal(1).optional(),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/u),
  name: nonEmptyString,
  description: nonEmptyString,
  readmeUrl: nonEmptyString.optional(),
  author: nonEmptyString,
  authorUrl: z.string().url().optional(),
  authorAvatarUrl: z.string().url().optional(),
  appearance: registryAppearanceSchema.optional(),
  channel: z.enum(["official", "community"]),
  status: registryCatalogStatusSchema,
  latestVersion: nonEmptyString,
  minAppVersion: nonEmptyString,
  platforms: z.array(nonEmptyString).min(1),
  categories: z.array(nonEmptyString),
  badges: z.array(nonEmptyString).default([]),
  owner: registryOwnerSchema,
  latestRelease: z
    .object({
      releasedAt: z.string().datetime({ offset: true }),
      bundleSize: z.number().int().nonnegative(),
    })
    .optional(),
  detail: nonEmptyString,
  contributes: registryContributionsSchema.optional(),
});

export const registryCatalogIndexSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  plugins: z.array(registryCatalogEntrySchema),
});

export const registryCatalogDetailSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/u),
  name: nonEmptyString,
  description: nonEmptyString,
  readmeUrl: nonEmptyString.optional(),
  author: nonEmptyString,
  authorUrl: z.string().url().optional(),
  authorAvatarUrl: z.string().url().optional(),
  appearance: registryAppearanceSchema.optional(),
  media: z
    .object({
      banner: registryMediaItemSchema.optional(),
      overview: registryMediaItemSchema.optional(),
    })
    .optional(),
  gallery: z.array(registryGalleryItemSchema).optional(),
  channel: z.enum(["official", "community"]),
  status: registryCatalogStatusSchema,
  owner: registryOwnerSchema,
  latestVersion: nonEmptyString,
  license: nonEmptyString.optional(),
  links: z
    .object({
      homepage: z.string().url().optional(),
      repository: z.string().url().optional(),
      documentation: z.string().url().optional(),
      issues: z.string().url().optional(),
    })
    .optional(),
  highlights: z.array(nonEmptyString).optional(),
  content: z
    .object({
      overview: registryMarkdownReferenceSchema.optional(),
      changelog: registryMarkdownReferenceSchema.optional(),
    })
    .optional(),
  contributes: registryContributionsSchema.optional(),
  versions: z.record(nonEmptyString, registryReleaseSchema),
});

export const registryRuntimeSchema = z.object({
  schemaVersion: z.literal(1),
  backend: z.literal("nostr-nip29"),
  registryRoot: nonEmptyString,
  sourceRegistryRoot: nonEmptyString.optional(),
  relays: z.array(z.string().url()),
  releaseGroupId: nonEmptyString,
  curatorPubkeys: z.array(nonEmptyString),
  publisherPubkeys: z.array(nonEmptyString),
});

export type RegistryCatalogStatus = z.infer<typeof registryCatalogStatusSchema>;
export type RegistryImageReference = z.infer<
  typeof registryImageReferenceSchema
>;
export type RegistryAppearance = z.infer<typeof registryAppearanceSchema>;
export type RegistryGalleryItem = z.infer<typeof registryGalleryItemSchema>;
export type RegistryMediaItem = z.infer<typeof registryMediaItemSchema>;
export type RegistryMarkdownReference = z.infer<
  typeof registryMarkdownReferenceSchema
>;
export type RegistryRelease = z.infer<typeof registryReleaseSchema>;
export type RegistryCatalogEntry = z.infer<typeof registryCatalogEntrySchema>;
export type RegistryCatalogIndex = z.infer<typeof registryCatalogIndexSchema>;
export type RegistryCatalogDetail = z.infer<typeof registryCatalogDetailSchema>;
export type RegistryRuntime = z.infer<typeof registryRuntimeSchema>;

export type RegistryRoute =
  | { page: "landing" }
  | { page: "directory" }
  | { page: "plugin"; pluginId: string };

export type RegistryDirectorySort = "name" | "new" | "updated" | "status";
export type RegistryDirectoryView = "grid" | "list";

export interface RegistryDirectoryState {
  query: string;
  categories: readonly string[];
  platforms: readonly string[];
  statuses: readonly RegistryCatalogStatus[];
  officialOnly: boolean;
  sort: RegistryDirectorySort;
  view: RegistryDirectoryView;
}

export type RegistryInstallAction =
  | { state: "available"; label?: string }
  | { state: "installing"; label?: string }
  | { state: "installed"; label?: string }
  | { state: "disabled"; label?: string; reason: string }
  | { state: "rejected"; label?: string; reason: string };

export interface RegistryInstallRequest {
  pluginId: string;
  version: string;
  bundle: RegistryRelease["bundle"];
}

export interface RegistryLoadOptions {
  signal?: AbortSignal;
}

export type RegistryReleaseInspectionState =
  | "approved"
  | "pending"
  | "rejected"
  | "revoked"
  | "untrusted"
  | "invalid"
  | "unavailable";

export type RegistryReleaseValidationStage =
  | "event"
  | "authority"
  | "attachment"
  | "manifest"
  | "schema"
  | "projection";

export interface RegistryReleaseDiagnostic {
  stage: RegistryReleaseValidationStage;
  code: string;
  path?: string;
  message: string;
}

export interface RegistryReleasePreview {
  entry: RegistryCatalogEntry;
  detail: RegistryCatalogDetail;
}

export interface RegistryReleaseInspection {
  eventId: string;
  state: RegistryReleaseInspectionState;
  pluginId?: string;
  version?: string;
  manifestSha256?: string;
  preview?: RegistryReleasePreview;
  diagnostics: readonly RegistryReleaseDiagnostic[];
}

export type RegistryCatalogSourcePhase =
  | "loading"
  | "ready"
  | "refreshing"
  | "degraded"
  | "error";

export interface RegistryCatalogRelayStatus {
  relay: string;
  error?: string;
}

export interface RegistryCatalogSourceStatus {
  phase: RegistryCatalogSourcePhase;
  fresh: boolean;
  installReady: boolean;
  origin?: "cache" | "relay";
  registryRoot?: string;
  synchronizedAt?: string;
  message?: string;
  relays: readonly RegistryCatalogRelayStatus[];
}

export type RegistryCatalogSourceEvent =
  | { type: "status"; status: RegistryCatalogSourceStatus }
  | { type: "revision"; status: RegistryCatalogSourceStatus };

export type RegistryCatalogSourceListener = (
  event: RegistryCatalogSourceEvent,
) => void;

export interface RegistryCatalogDataSource {
  loadIndex(options?: RegistryLoadOptions): Promise<RegistryCatalogIndex>;
  loadRuntime(options?: RegistryLoadOptions): Promise<RegistryRuntime | null>;
  loadPluginDetail(
    entry: RegistryCatalogEntry,
    options?: RegistryLoadOptions,
  ): Promise<RegistryCatalogDetail>;
  loadMarkdown(
    reference: RegistryMarkdownReference,
    options?: RegistryLoadOptions,
  ): Promise<string>;
  loadImage?(
    reference: RegistryImageReference,
    options?: RegistryLoadOptions,
  ): Promise<Blob>;
  loadReleaseInspection?(
    eventId: string,
    options?: RegistryLoadOptions,
  ): Promise<RegistryReleaseInspection | undefined>;
  loadReleaseProof?(
    pluginId: string,
    version: string,
    options?: RegistryLoadOptions,
  ): Promise<NostrReleaseProof>;
  getStatus?(): RegistryCatalogSourceStatus;
  subscribe?(listener: RegistryCatalogSourceListener): () => void;
  refresh?(options?: RegistryLoadOptions): Promise<void>;
  dispose?(): void;
}

export interface LiveRegistryCatalogDataSource
  extends RegistryCatalogDataSource {
  loadImage(
    reference: RegistryImageReference,
    options?: RegistryLoadOptions,
  ): Promise<Blob>;
  loadReleaseProof(
    pluginId: string,
    version: string,
    options?: RegistryLoadOptions,
  ): Promise<NostrReleaseProof>;
  getStatus(): RegistryCatalogSourceStatus;
  subscribe(listener: RegistryCatalogSourceListener): () => void;
  refresh(options?: RegistryLoadOptions): Promise<void>;
  dispose(): void;
}

export interface RegistryResolvedDetail {
  entry: RegistryCatalogEntry;
  detail: RegistryCatalogDetail;
  overviewHtml?: string;
  changelogHtml?: string;
  contentError?: string;
}
