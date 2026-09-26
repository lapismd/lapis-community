export interface BlossomUploadLabels {
  purpose?: "avatar" | "emoji" | "plugin";
  plugin?: string;
  slot?: string;
}

export interface BlossomUploadDescriptor {
  url?: unknown;
  sha256?: unknown;
  size?: unknown;
  type?: unknown;
  nip94?: unknown;
}

export interface VerifiedBlossomImageDescriptor {
  url: string;
  sha256: string;
  size: number;
  type: string;
  nip94: string[][];
}

export function blossomUploadTags(
  digest: string,
  host: string,
  now: number,
  labels: BlossomUploadLabels,
): string[][] {
  if (labels.purpose === "plugin" && !labels.plugin)
    throw new Error("Plugin image uploads require a plugin identifier.");
  if (labels.plugin && labels.purpose !== "plugin")
    throw new Error("Plugin identifiers require plugin image purpose.");
  for (const value of [labels.plugin, labels.slot]) {
    if (value !== undefined && !/^[a-z0-9]+(?:[-:.][a-z0-9]+)*$/u.test(value))
      throw new Error("Invalid image upload label.");
  }
  return [
    ["t", "upload"],
    ["x", digest],
    ["expiration", String(now + 300)],
    ["server", host],
    ...(labels.purpose ? [["lapis-purpose", labels.purpose]] : []),
    ...(labels.plugin ? [["lapis-plugin", labels.plugin]] : []),
    ...(labels.slot ? [["lapis-slot", labels.slot]] : []),
  ];
}

export function verifiedBlossomImageUrl(
  descriptor: BlossomUploadDescriptor,
  digest: string,
  size: number,
): string {
  return verifiedBlossomImageDescriptor(descriptor, digest, size).url;
}

export function verifiedBlossomImageDescriptor(
  descriptor: BlossomUploadDescriptor,
  digest: string,
  size: number,
): VerifiedBlossomImageDescriptor {
  const url = typeof descriptor.url === "string" ? descriptor.url : "";
  const mediaType = typeof descriptor.type === "string" ? descriptor.type : "";
  let parsed: URL | undefined;
  try {
    parsed = new URL(url);
  } catch {
    // Invalid URLs fail the descriptor check below.
  }
  const hashes = parsed?.pathname.matchAll(
    /(?:^|[^0-9a-f])([0-9a-f]{64})(?![0-9a-f])/gu,
  );
  const lastHash = hashes ? [...hashes].at(-1)?.[1] : undefined;
  if (
    typeof descriptor.sha256 !== "string" ||
    descriptor.sha256.toLowerCase() !== digest ||
    descriptor.size !== size ||
    !mediaType.startsWith("image/") ||
    parsed === undefined ||
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    lastHash !== digest
  )
    throw new Error("Uploaded profile image descriptor failed verification.");
  const nip94 = parseNip94Tags(descriptor.nip94);
  if (nip94.length > 0) {
    verifyNip94Value(nip94, "url", url);
    verifyNip94Value(nip94, "m", mediaType);
    verifyNip94Value(nip94, "x", digest);
    verifyNip94Value(nip94, "size", String(size));
    const dimensions = nip94.find((tag) => tag[0] === "dim");
    if (dimensions && !/^\d+x\d+$/u.test(dimensions[1] ?? ""))
      throw new Error("Uploaded profile image NIP-94 dimensions are invalid.");
  }
  return { url, sha256: digest, size, type: mediaType, nip94 };
}

function parseNip94Tags(value: unknown): string[][] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some(
      (tag) =>
        !Array.isArray(tag) ||
        tag.length < 2 ||
        tag.some((part) => typeof part !== "string"),
    )
  )
    throw new Error("Uploaded profile image NIP-94 metadata is invalid.");
  return value.map((tag) => [...tag] as string[]);
}

function verifyNip94Value(
  tags: readonly string[][],
  name: "url" | "m" | "x" | "size",
  expected: string,
): void {
  const values = tags.filter((tag) => tag[0] === name);
  if (values.length !== 1 || values[0]?.[1] !== expected)
    throw new Error(
      `Uploaded profile image NIP-94 ${name} tag failed verification.`,
    );
}
