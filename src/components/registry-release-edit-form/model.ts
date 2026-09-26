import { formatRegistryBytes } from "../../registry/catalog.js";
import type {
  RegistryCatalogStatus,
  RegistryGalleryItem,
  RegistryImageReference,
  RegistryMediaItem,
  RegistryChangelogTag,
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

export type RegistryReleaseImageVariantDrafts = Record<
  RegistryReleaseGalleryVariant,
  RegistryReleaseMediaReferenceDraft | null
>;

export interface RegistryReleaseImageSetDraft {
  alt: string;
  images: RegistryReleaseImageVariantDrafts;
}

export interface RegistryReleaseGalleryItemDraft
  extends RegistryReleaseImageSetDraft {
  id: string;
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
    changelog: {
      title: string;
      description: string;
      tags: RegistryChangelogTag[];
    };
  };
  media: {
    logo: RegistryReleaseImageSetDraft | null;
    banner: RegistryReleaseImageSetDraft | null;
    overview: RegistryReleaseImageSetDraft | null;
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

export const registryReleasePlatformSuggestions = ["desktop", "web", "mobile"];

export const registryReleaseChangelogTagSuggestions: RegistryChangelogTag[] = [
  "feature",
  "improvement",
  "fix",
  "security",
  "breaking",
  "deprecation",
  "removal",
];

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
      changelog: {
        title: release?.changelog?.title ?? "",
        description:
          release?.changelog?.description ?? release?.releasePost ?? "",
        tags: [...(release?.changelog?.tags ?? [])],
      },
    },
    media: {
      logo: detail.appearance?.logo
        ? imageSetDraft(detail.appearance.logo.alt, {
            full: detail.appearance.logo,
          })
        : null,
      banner: mediaDraft(detail.media?.banner),
      overview: mediaDraft(detail.media?.overview),
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
    ...createBlankImageSet(alt, "full"),
  };
}

export function createBlankImageSet(
  alt: string,
  initialVariant: RegistryReleaseGalleryVariant = "full",
): RegistryReleaseImageSetDraft {
  const images: RegistryReleaseImageVariantDrafts = {
    light: null,
    dark: null,
    full: null,
  };
  images[initialVariant] = createBlankMediaReference(alt);
  return {
    alt,
    images,
  };
}

function mediaDraft(
  media: RegistryMediaItem | undefined,
): RegistryReleaseImageSetDraft | null {
  if (!media) return null;
  return imageSetDraft(media.alt, {
    light: media.images.light,
    dark: media.images.dark,
    full: media.images.full,
  });
}

function galleryDraft(
  item: RegistryGalleryItem,
): RegistryReleaseGalleryItemDraft {
  return {
    id: item.id,
    alt: item.alt,
    images: imageSetDraft(item.alt, {
      light: item.images.light,
      dark: item.images.dark,
      full: item.images.full,
    }).images,
  };
}

function imageSetDraft(
  alt: string,
  images: Partial<
    Record<RegistryReleaseGalleryVariant, RegistryImageReference>
  >,
): RegistryReleaseImageSetDraft {
  return {
    alt,
    images: {
      light: images.light ? imageDraft(images.light, alt) : null,
      dark: images.dark ? imageDraft(images.dark, alt) : null,
      full: images.full ? imageDraft(images.full, alt) : null,
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
