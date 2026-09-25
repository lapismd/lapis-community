export const COMMUNITY_AVATAR_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export const COMMUNITY_AVATAR_IMAGE_ACCEPT =
  COMMUNITY_AVATAR_IMAGE_TYPES.join(",");

export interface ResolveCommunityAvatarImageOptions {
  upload?: ((file: File) => Promise<string>) | undefined;
  setReader?: ((reader: FileReader) => void) | undefined;
}

export async function resolveCommunityAvatarImage(
  file: File,
  options: ResolveCommunityAvatarImageOptions = {},
): Promise<string> {
  if (!isCommunityAvatarImageType(file.type)) {
    throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
  }
  if (options.upload !== undefined) return options.upload(file);
  if (file.size > 1024 * 1024) {
    throw new Error("Choose an image smaller than 1 MB.");
  }
  return readImageDataUrl(file, options.setReader);
}

export function isCommunityAvatarImageType(type: string): boolean {
  return (COMMUNITY_AVATAR_IMAGE_TYPES as readonly string[]).includes(type);
}

function readImageDataUrl(
  file: File,
  setReader: ResolveCommunityAvatarImageOptions["setReader"],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    setReader?.(reader);
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The image could not be read. Try again."));
    });
    reader.addEventListener("error", () => {
      reject(new Error("The image could not be read. Try again."));
    });
    reader.readAsDataURL(file);
  });
}
