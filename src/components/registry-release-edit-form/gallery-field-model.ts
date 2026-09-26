import type {
  RegistryReleaseGalleryItemDraft,
  RegistryReleaseGalleryVariant,
  RegistryReleaseImageSetDraft,
  RegistryReleaseMediaReferenceDraft,
} from "./model.js";

export type GalleryImageField =
  | "url"
  | "sourceUrl"
  | "sha256"
  | "size"
  | "width"
  | "height";

export const galleryVariantOptions: {
  key: RegistryReleaseGalleryVariant;
  label: string;
}[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "full", label: "Split" },
];

export const galleryTextFieldOptions: {
  key: GalleryImageField;
  label: string;
  ariaLabel: string;
}[] = [
  { key: "url", label: "Image URL", ariaLabel: "image URL" },
  { key: "sourceUrl", label: "Source URL", ariaLabel: "source URL" },
  { key: "sha256", label: "SHA-256", ariaLabel: "SHA-256" },
];

export const galleryNumberFieldOptions: {
  key: GalleryImageField;
  label: string;
  ariaLabel: string;
}[] = [
  { key: "size", label: "Size", ariaLabel: "size bytes" },
  { key: "width", label: "Width", ariaLabel: "width" },
  { key: "height", label: "Height", ariaLabel: "height" },
];

export function galleryVariantFor(
  item: RegistryReleaseImageSetDraft,
  selected: RegistryReleaseGalleryVariant | undefined,
): RegistryReleaseGalleryVariant {
  if (selected) return selected;
  return (
    galleryVariantOptions.find((option) => item.images[option.key] !== null)
      ?.key ??
    selected ??
    "full"
  );
}

export function galleryVariantLabel(
  variant: RegistryReleaseGalleryVariant,
): string {
  return (
    galleryVariantOptions.find((option) => option.key === variant)?.label ??
    "Split"
  );
}

export function mapGalleryImages(
  item: RegistryReleaseImageSetDraft,
  map: (
    image: RegistryReleaseMediaReferenceDraft,
  ) => RegistryReleaseMediaReferenceDraft,
): RegistryReleaseImageSetDraft["images"] {
  return {
    light: item.images.light === null ? null : map(item.images.light),
    dark: item.images.dark === null ? null : map(item.images.dark),
    full: item.images.full === null ? null : map(item.images.full),
  };
}

export function nextGalleryItemCount(
  items: readonly RegistryReleaseGalleryItemDraft[],
): number {
  let count = items.length;
  while (items.some((item) => item.id === `screenshot-${count + 1}`)) {
    count += 1;
  }
  return count;
}
