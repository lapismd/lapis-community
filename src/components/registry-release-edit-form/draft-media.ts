import type {
  RegistryGalleryItem,
  RegistryImageReference,
  RegistryMediaItem,
} from "../../registry/model.js";
import type {
  RegistryReleaseGalleryItemDraft,
  RegistryReleaseGalleryVariant,
  RegistryReleaseImageSetDraft,
  RegistryReleaseMediaReferenceDraft,
} from "./model.js";

const mediaVariantOrder: RegistryReleaseGalleryVariant[] = [
  "full",
  "light",
  "dark",
];

export function imageReferenceFromDraft(
  draft: RegistryReleaseMediaReferenceDraft,
): RegistryImageReference {
  return {
    url: draft.url,
    sourceUrl: draft.sourceUrl,
    sha256: draft.sha256,
    size: parseInteger(draft.size, 0),
    mediaType: draft.mediaType,
    width: parseInteger(draft.width, 1),
    height: parseInteger(draft.height, 1),
  };
}

export function logoReferenceFromDraft(
  draft: RegistryReleaseImageSetDraft | null,
): (RegistryImageReference & { alt: string }) | undefined {
  const fallback = fallbackImageDraft(draft);
  return fallback === undefined
    ? undefined
    : { ...imageReferenceFromDraft(fallback), alt: draft!.alt };
}

export function mediaItemFromImageSetDraft(
  draft: RegistryReleaseImageSetDraft | null,
): RegistryMediaItem | undefined {
  const fallback = fallbackImageDraft(draft);
  if (draft === null || fallback === undefined) return undefined;
  const fallbackReference = imageReferenceFromDraft(fallback);
  return {
    alt: draft.alt,
    images: {
      preview: imageReferenceFromDraft(draft.images.full ?? fallback),
      full: draft.images.full
        ? imageReferenceFromDraft(draft.images.full)
        : fallbackReference,
      light: draft.images.light
        ? imageReferenceFromDraft(draft.images.light)
        : fallbackReference,
      dark: draft.images.dark
        ? imageReferenceFromDraft(draft.images.dark)
        : fallbackReference,
    },
  };
}

export function galleryItemFromDraft(
  draft: RegistryReleaseGalleryItemDraft,
): RegistryGalleryItem | undefined {
  const item = mediaItemFromImageSetDraft(draft);
  return item === undefined ? undefined : { id: draft.id, ...item };
}

function fallbackImageDraft(
  draft: RegistryReleaseImageSetDraft | null,
): RegistryReleaseMediaReferenceDraft | undefined {
  if (draft === null) return undefined;
  for (const variant of mediaVariantOrder) {
    const image = draft.images[variant];
    if (image !== null) return image;
  }
  return undefined;
}

function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
