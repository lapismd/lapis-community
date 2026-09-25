import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { encodeNostrHttpAuthorization } from "../nostr/http-authorization.js";
import type { CommunityIdentity } from "./contracts.js";

export const COMMUNITY_PROFILE_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export interface CommunityProfileImageUploadOptions {
  relayUrl: string;
  identity: CommunityIdentity;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  content?: string;
}

interface BlossomUploadDescriptor {
  url?: unknown;
  sha256?: unknown;
  size?: unknown;
  type?: unknown;
}

export async function uploadCommunityProfileImage(
  file: File,
  options: CommunityProfileImageUploadOptions,
): Promise<string> {
  if (
    !(COMMUNITY_PROFILE_IMAGE_TYPES as readonly string[]).includes(file.type)
  ) {
    throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
  }
  const fetcher = options.fetch ?? globalThis.fetch;
  if (fetcher === undefined) throw new Error("Image upload is unavailable.");
  const body = new Uint8Array(await file.arrayBuffer());
  const digest = bytesToHex(sha256(body));
  const base = relayHttpBaseUrl(options.relayUrl);
  const now = options.now?.() ?? Math.floor(Date.now() / 1_000);
  const auth = await options.identity.signEvent({
    kind: 24_242,
    created_at: now,
    content: options.content ?? "Upload Lapis profile image",
    tags: [
      ["t", "upload"],
      ["x", digest],
      ["expiration", String(now + 300)],
      ["server", base.host],
    ],
  });
  const response = await fetcher(new URL("/upload", base), {
    method: "PUT",
    headers: {
      Authorization: encodeNostrHttpAuthorization(auth),
      "Content-Type": file.type,
      "X-SHA-256": digest,
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error(await uploadErrorMessage(response));
  }
  const descriptor = (await response.json()) as BlossomUploadDescriptor;
  const url = typeof descriptor.url === "string" ? descriptor.url : "";
  if (
    typeof descriptor.sha256 !== "string" ||
    descriptor.sha256.toLowerCase() !== digest ||
    descriptor.size !== body.byteLength ||
    typeof descriptor.type !== "string" ||
    !descriptor.type.startsWith("image/") ||
    url.trim() === ""
  ) {
    throw new Error("Uploaded profile image descriptor failed verification.");
  }
  return url;
}

export function relayHttpBaseUrl(relayUrl: string): URL {
  const url = new URL(relayUrl);
  if (url.protocol === "wss:") url.protocol = "https:";
  else if (url.protocol === "ws:") url.protocol = "http:";
  else if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Relay URL must use ws://, wss://, http://, or https://");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

async function uploadErrorMessage(response: Response): Promise<string> {
  const fallback = `Profile image upload failed with ${response.status}`;
  try {
    const body = (await response.text()).trim();
    return body || fallback;
  } catch {
    return fallback;
  }
}
