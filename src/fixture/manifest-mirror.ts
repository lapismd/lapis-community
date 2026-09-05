import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export interface UploadedBlobDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
}

export interface MirroredManifestAttachment {
  url: string;
  mimeType: string;
  sha256: string;
  size: number;
}

export function mirrorUploadedManifest(
  descriptor: UploadedBlobDescriptor,
  bytes: Uint8Array,
  publicBaseUrl: URL,
  artifacts: Map<string, Uint8Array>,
): MirroredManifestAttachment {
  const sha256Hex = bytesToHex(sha256(bytes));
  if (descriptor.sha256 !== sha256Hex || descriptor.size !== bytes.byteLength) {
    throw new Error("Uploaded release manifest descriptor failed verification");
  }

  const pathname = `/${sha256Hex}.json`;
  artifacts.set(pathname, Uint8Array.from(bytes));
  return {
    url: new URL(pathname.slice(1), publicBaseUrl).toString(),
    mimeType: descriptor.type,
    sha256: sha256Hex,
    size: bytes.byteLength,
  };
}
