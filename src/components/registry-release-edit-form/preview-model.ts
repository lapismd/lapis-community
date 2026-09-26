import type {
  RegistryCatalogDetail,
  RegistryCatalogEntry,
  RegistryRelease,
  RegistryResolvedDetail,
} from "../../registry/model.js";
import {
  galleryItemFromDraft,
  logoReferenceFromDraft,
  mediaItemFromImageSetDraft,
} from "./draft-media.js";
import type { RegistryReleaseEditDraft } from "./model.js";

export function resolvedDetailFromDraft(
  resolved: RegistryResolvedDetail,
  draft: RegistryReleaseEditDraft,
): RegistryResolvedDetail {
  const originalRelease =
    resolved.detail.versions[resolved.detail.latestVersion];
  const release = releaseFromDraft(draft, originalRelease);
  const latestVersion = release.version;
  const entry = entryFromDraft(resolved.entry, draft, release);
  const detail = detailFromDraft(resolved.detail, draft, release);
  return {
    ...resolved,
    entry,
    detail: {
      ...detail,
      latestVersion,
      versions: versionsFromDraft(resolved.detail, release),
    },
  };
}

function entryFromDraft(
  entry: RegistryCatalogEntry,
  draft: RegistryReleaseEditDraft,
  release: RegistryRelease,
): RegistryCatalogEntry {
  const authorUrl = optionalText(draft.plugin.authorUrl);
  const authorAvatarUrl = optionalText(draft.plugin.authorAvatarUrl);
  return {
    ...entry,
    name: draft.plugin.name,
    description: draft.plugin.description,
    author: draft.plugin.author,
    ...(authorUrl === undefined ? {} : { authorUrl }),
    ...(authorAvatarUrl === undefined ? {} : { authorAvatarUrl }),
    appearance: appearanceFromDraft(entry.appearance, draft),
    channel: draft.plugin.channel,
    status: draft.plugin.status,
    latestVersion: release.version,
    minAppVersion: release.minAppVersion,
    platforms: nonEmptyList(draft.plugin.platforms, entry.platforms),
    categories: [...draft.plugin.categories],
    latestRelease: {
      releasedAt: release.releasedAt,
      bundleSize: release.bundle.size,
    },
  };
}

function detailFromDraft(
  detail: RegistryCatalogDetail,
  draft: RegistryReleaseEditDraft,
  release: RegistryRelease,
): RegistryCatalogDetail {
  const authorUrl = optionalText(draft.plugin.authorUrl);
  const authorAvatarUrl = optionalText(draft.plugin.authorAvatarUrl);
  const license = optionalText(draft.plugin.license);
  return {
    ...detail,
    name: draft.plugin.name,
    description: draft.plugin.description,
    author: draft.plugin.author,
    ...(authorUrl === undefined ? {} : { authorUrl }),
    ...(authorAvatarUrl === undefined ? {} : { authorAvatarUrl }),
    appearance: appearanceFromDraft(detail.appearance, draft),
    media: mediaFromDraft(draft),
    gallery: draft.media.gallery.flatMap((item) => {
      const galleryItem = galleryItemFromDraft(item);
      return galleryItem === undefined ? [] : [galleryItem];
    }),
    channel: draft.plugin.channel,
    status: draft.plugin.status,
    latestVersion: release.version,
    ...(license === undefined ? {} : { license }),
    links: linksFromDraft(draft),
    highlights: [...draft.plugin.highlights],
  };
}

function releaseFromDraft(
  draft: RegistryReleaseEditDraft,
  original: RegistryRelease | undefined,
): RegistryRelease {
  const fallbackBundle = original?.bundle ?? {
    url: draft.evidence.artifactUrl,
    sha256: draft.evidence.artifactSha256,
    size: 0,
    pending: true,
  };
  return {
    version: draft.release.version || original?.version || "0.0.0",
    minAppVersion:
      draft.release.minAppVersion || original?.minAppVersion || "Unknown",
    releasedAt:
      draft.release.releasedAt ||
      original?.releasedAt ||
      new Date(0).toISOString(),
    platforms: nonEmptyList(draft.release.platforms, original?.platforms ?? []),
    ...(changelogFromDraft(draft) === undefined
      ? {}
      : { changelog: changelogFromDraft(draft) }),
    bundle: {
      ...fallbackBundle,
      url: draft.evidence.artifactUrl || fallbackBundle.url,
      sha256: draft.evidence.artifactSha256 || fallbackBundle.sha256,
    },
    ...(draft.evidence.releaseEventId === "Unknown"
      ? {}
      : { releaseEventId: draft.evidence.releaseEventId }),
    ...(draft.evidence.manifestSha256 === "Unknown"
      ? {}
      : { manifestSha256: draft.evidence.manifestSha256 }),
  };
}

function changelogFromDraft(
  draft: RegistryReleaseEditDraft,
): RegistryRelease["changelog"] {
  const title = optionalText(draft.release.changelog.title);
  const description = optionalText(draft.release.changelog.description);
  const tags = draft.release.changelog.tags;
  if (title === undefined && description === undefined && tags.length === 0) {
    return undefined;
  }
  return {
    title: title ?? "Untitled release notes",
    ...(description === undefined ? {} : { description }),
    ...(tags.length === 0 ? {} : { tags: [...tags] }),
  };
}

function versionsFromDraft(
  detail: RegistryCatalogDetail,
  release: RegistryRelease,
): RegistryCatalogDetail["versions"] {
  const versions = { ...detail.versions };
  if (detail.latestVersion !== release.version)
    delete versions[detail.latestVersion];
  return { ...versions, [release.version]: release };
}

function appearanceFromDraft(
  appearance: RegistryCatalogDetail["appearance"],
  draft: RegistryReleaseEditDraft,
): RegistryCatalogDetail["appearance"] {
  return {
    ...(appearance ?? { icon: "package", accent: "var(--primary)" }),
    ...(logoReferenceFromDraft(draft.media.logo) === undefined
      ? {}
      : { logo: logoReferenceFromDraft(draft.media.logo) }),
  };
}

function mediaFromDraft(
  draft: RegistryReleaseEditDraft,
): RegistryCatalogDetail["media"] {
  const banner = mediaItemFromImageSetDraft(draft.media.banner);
  const overview = mediaItemFromImageSetDraft(draft.media.overview);
  return {
    ...(banner === undefined ? {} : { banner }),
    ...(overview === undefined ? {} : { overview }),
  };
}

function linksFromDraft(
  draft: RegistryReleaseEditDraft,
): RegistryCatalogDetail["links"] {
  const links = Object.fromEntries(
    Object.entries(draft.plugin.links).filter(([, value]) => value.trim()),
  );
  return Object.keys(links).length === 0 ? undefined : links;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function nonEmptyList(values: string[], fallback: string[]): string[] {
  return values.length === 0 ? [...fallback] : [...values];
}
