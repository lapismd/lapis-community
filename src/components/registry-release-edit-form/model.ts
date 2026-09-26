import { formatRegistryBytes } from "../../registry/catalog.js";
import type {
  RegistryCatalogStatus,
  RegistryGalleryItem,
  RegistryImageReference,
  RegistryMarkdownReference,
  RegistryMediaItem,
  RegistryResolvedDetail,
} from "../../registry/model.js";

export type RegistryReleaseImageMediaType =
  | "image/png"
  | "image/webp"
  | "image/svg+xml";

export interface RegistryReleaseMediaReferenceDraft {
  alt: string;
  url: string;
  sourceUrl: string;
  sha256: string;
  size: string;
  mediaType: RegistryReleaseImageMediaType;
  width: string;
  height: string;
}

export type RegistryReleaseGalleryVariant = "light" | "dark" | "full";

export interface RegistryReleaseGalleryItemDraft {
  id: string;
  alt: string;
  images: Record<
    RegistryReleaseGalleryVariant,
    RegistryReleaseMediaReferenceDraft | null
  >;
}

export interface RegistryReleaseEditDraft {
  plugin: {
    id: string;
    name: string;
    description: string;
    author: string;
    authorUrl: string;
    authorAvatarUrl: string;
    channel: "official" | "community";
    status: RegistryCatalogStatus;
    categories: string[];
    platforms: string[];
    license: string;
    links: {
      homepage: string;
      repository: string;
      documentation: string;
      issues: string;
    };
    highlights: string[];
  };
  release: {
    version: string;
    minAppVersion: string;
    releasedAt: string;
    platforms: string[];
  };
  content: {
    overview: RegistryMarkdownReferenceDraft;
    changelog: RegistryMarkdownReferenceDraft;
  };
  media: {
    logo: RegistryReleaseMediaReferenceDraft | null;
    banner: RegistryReleaseMediaReferenceDraft | null;
    overview: RegistryReleaseMediaReferenceDraft | null;
    gallery: RegistryReleaseGalleryItemDraft[];
  };
  evidence: {
    publisherIdentity: string;
    releaseEventId: string;
    manifestSha256: string;
    artifactUrl: string;
    artifactSha256: string;
    bundleSize: string;
  };
}

export interface RegistryMarkdownReferenceDraft {
  url: string;
  sourceUrl: string;
  sha256: string;
  size: string;
}

export interface RegistryReleaseEditDraftOptions {
  releaseEventId?: string;
  manifestSha256?: string;
  publisherIdentity?: string;
}

const emptySha256 = "0".repeat(64);

export const registryReleaseChannelOptions = [
  { value: "official", label: "Official" },
  { value: "community", label: "Community" },
];

export const registryReleaseStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "deprecated", label: "Deprecated" },
  { value: "disabled", label: "Disabled" },
  { value: "revoked", label: "Revoked" },
];

export const registryReleasePlatformSuggestions = ["desktop", "web", "mobile"];

export const registryReleaseCategorySuggestions = [
  "ai",
  "backup",
  "data",
  "export",
  "knowledge",
  "markdown",
  "navigation",
  "presentation",
  "productivity",
  "search",
  "visualization",
];

export function draftFromResolvedDetail(
  resolved: RegistryResolvedDetail,
  options: RegistryReleaseEditDraftOptions = {},
): RegistryReleaseEditDraft {
  const { entry, detail } = resolved;
  const release = detail.versions[detail.latestVersion];
  return {
    plugin: {
      id: detail.id,
      name: detail.name,
      description: detail.description,
      author: detail.author,
      authorUrl: detail.authorUrl ?? entry.authorUrl ?? detail.owner.url ?? "",
      authorAvatarUrl: detail.authorAvatarUrl ?? entry.authorAvatarUrl ?? "",
      channel: detail.channel,
      status: detail.status,
      categories: [...entry.categories],
      platforms: [...entry.platforms],
      license: detail.license ?? "",
      links: {
        homepage: detail.links?.homepage ?? "",
        repository: detail.links?.repository ?? "",
        documentation: detail.links?.documentation ?? "",
        issues: detail.links?.issues ?? "",
      },
      highlights: [...(detail.highlights ?? [])],
    },
    release: {
      version: release?.version ?? detail.latestVersion,
      minAppVersion: release?.minAppVersion ?? entry.minAppVersion,
      releasedAt: release?.releasedAt ?? "",
      platforms: [...(release?.platforms ?? entry.platforms)],
    },
    content: {
      overview: markdownDraft(detail.content?.overview),
      changelog: markdownDraft(detail.content?.changelog),
    },
    media: {
      logo: detail.appearance?.logo
        ? imageDraft(detail.appearance.logo, detail.appearance.logo.alt)
        : null,
      banner: mediaDraft(detail.media?.banner, "dark"),
      overview: mediaDraft(detail.media?.overview, "preview"),
      gallery: (detail.gallery ?? []).map(galleryDraft),
    },
    evidence: {
      publisherIdentity:
        options.publisherIdentity ?? detail.owner.url ?? detail.owner.name,
      releaseEventId:
        options.releaseEventId ?? release?.releaseEventId ?? "Unknown",
      manifestSha256:
        options.manifestSha256 ?? release?.manifestSha256 ?? "Unknown",
      artifactUrl: release?.bundle.url ?? "Unknown",
      artifactSha256: release?.bundle.sha256 ?? "Unknown",
      bundleSize:
        release === undefined
          ? "Unknown"
          : formatRegistryBytes(release.bundle.size),
    },
  };
}

export function createBlankMediaReference(
  alt = "New screenshot",
): RegistryReleaseMediaReferenceDraft {
  return {
    alt,
    url: "",
    sourceUrl: "",
    sha256: emptySha256,
    size: "0",
    mediaType: "image/webp",
    width: "1440",
    height: "960",
  };
}

export function createBlankGalleryItem(
  count: number,
): RegistryReleaseGalleryItemDraft {
  const alt = `Screenshot ${count + 1}`;
  return {
    id: `screenshot-${count + 1}`,
    alt,
    images: {
      light: null,
      dark: null,
      full: createBlankMediaReference(alt),
    },
  };
}

function markdownDraft(
  reference: RegistryMarkdownReference | undefined,
): RegistryMarkdownReferenceDraft {
  return {
    url: reference?.url ?? "",
    sourceUrl: reference?.sourceUrl ?? "",
    sha256: reference?.sha256 ?? emptySha256,
    size: reference?.size === undefined ? "0" : String(reference.size),
  };
}

function mediaDraft(
  media: RegistryMediaItem | undefined,
  mode: keyof RegistryMediaItem["images"],
): RegistryReleaseMediaReferenceDraft | null {
  if (!media) return null;
  return imageDraft(media.images[mode], media.alt);
}

function galleryDraft(
  item: RegistryGalleryItem,
): RegistryReleaseGalleryItemDraft {
  return {
    id: item.id,
    alt: item.alt,
    images: {
      light: imageDraft(item.images.light, item.alt),
      dark: imageDraft(item.images.dark, item.alt),
      full: imageDraft(item.images.full, item.alt),
    },
  };
}

function imageDraft(
  reference: RegistryImageReference,
  alt: string,
): RegistryReleaseMediaReferenceDraft {
  return {
    alt,
    url: reference.url,
    sourceUrl: reference.sourceUrl,
    sha256: reference.sha256,
    size: String(reference.size),
    mediaType: reference.mediaType,
    width: String(reference.width),
    height: String(reference.height),
  };
}
