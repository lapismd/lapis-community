import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const HEX_64 = /^[0-9a-f]{64}$/u;
const EXTENSION = /^[a-z0-9][a-z0-9+-]{0,15}$/u;
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

export interface BlossomUriReference {
  sha256: string;
  extension: string;
  authors: string[];
  serverHints: string[];
  size?: number;
}

export interface CreateBlossomUriOptions {
  sha256: string;
  extension?: string;
  authors?: readonly string[];
  serverHints?: readonly string[];
  size?: number;
}

export interface ResolveBlossomUriOptions {
  discoverAuthorServers?: (pubkey: string) => Promise<readonly string[]>;
  fallbackServers?: readonly string[];
  fetch?: typeof globalThis.fetch;
  maxBytes?: number;
  signal?: AbortSignal;
}

export interface ResolvedBlossomUri {
  bytes: Uint8Array;
  contentType?: string;
  reference: BlossomUriReference;
  url: string;
}

export function parseBlossomUri(value: string): BlossomUriReference {
  if (!value.startsWith("blossom:"))
    throw new Error("Blossom URI must use the blossom: scheme.");
  const parsed = new URL(value);
  if (parsed.hash !== "")
    throw new Error("Blossom URI must not contain a fragment.");
  const match = /^([0-9a-f]{64})\.([a-z0-9][a-z0-9+-]{0,15})$/u.exec(
    parsed.pathname,
  );
  if (!match)
    throw new Error("Blossom URI must contain a lowercase hash and extension.");
  for (const key of parsed.searchParams.keys()) {
    if (!["as", "xs", "sz"].includes(key))
      throw new Error(`Unsupported Blossom URI parameter: ${key}`);
  }
  const authors = parsed.searchParams.getAll("as");
  if (authors.some((author) => !HEX_64.test(author)))
    throw new Error("Blossom URI author hints must be lowercase hex pubkeys.");
  const serverHints = parsed.searchParams.getAll("xs");
  serverHints.forEach(serverCandidates);
  const sizes = parsed.searchParams.getAll("sz");
  if (sizes.length > 1)
    throw new Error("Blossom URI size must not be repeated.");
  const size = sizes.length === 1 ? positiveInteger(sizes[0] ?? "") : undefined;
  return {
    sha256: match[1]!,
    extension: match[2]!,
    authors,
    serverHints,
    ...(size === undefined ? {} : { size }),
  };
}

export function createBlossomUri(options: CreateBlossomUriOptions): string {
  if (!HEX_64.test(options.sha256))
    throw new Error("Blossom URI hash must be lowercase SHA-256 hex.");
  const extension = options.extension ?? "bin";
  if (!EXTENSION.test(extension))
    throw new Error("Blossom URI extension is invalid.");
  const query = new URLSearchParams();
  for (const server of options.serverHints ?? []) {
    serverCandidates(server);
    query.append("xs", server);
  }
  for (const author of options.authors ?? []) {
    if (!HEX_64.test(author))
      throw new Error(
        "Blossom URI author hints must be lowercase hex pubkeys.",
      );
    query.append("as", author);
  }
  if (options.size !== undefined)
    query.set("sz", String(positiveSize(options.size)));
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `blossom:${options.sha256}.${extension}${suffix}`;
}

export async function resolveBlossomUri(
  value: string | BlossomUriReference,
  options: ResolveBlossomUriOptions = {},
): Promise<ResolvedBlossomUri> {
  const reference = parseBlossomUri(
    typeof value === "string" ? value : createBlossomUri(value),
  );
  const fetcher = options.fetch ?? globalThis.fetch;
  if (fetcher === undefined)
    throw new Error("Blossom URI resolution is unavailable.");
  const maximum = options.maxBytes ?? DEFAULT_MAX_BYTES;
  positiveSize(maximum);
  if (reference.size !== undefined && reference.size > maximum)
    throw new Error("Blossom blob exceeds the configured download limit.");
  const origins: string[] = [];
  addServers(origins, reference.serverHints);
  if (options.discoverAuthorServers) {
    for (const author of reference.authors) {
      try {
        addServers(origins, await options.discoverAuthorServers(author));
      } catch {
        // A failed author lookup does not discard later hints or fallbacks.
      }
    }
  }
  addServers(origins, options.fallbackServers ?? []);
  for (const origin of origins) {
    const url = new URL(
      `${reference.sha256}.${reference.extension}`,
      `${origin}/`,
    );
    try {
      const response = await fetcher(
        url,
        options.signal ? { signal: options.signal } : {},
      );
      if (!response.ok || !validContentLength(response, reference, maximum))
        continue;
      const bytes = await readBounded(response, maximum);
      if (
        (reference.size !== undefined && bytes.byteLength !== reference.size) ||
        bytesToHex(sha256(bytes)) !== reference.sha256
      )
        continue;
      const contentType = response.headers.get("Content-Type") ?? undefined;
      return {
        bytes,
        ...(contentType === undefined ? {} : { contentType }),
        reference,
        url: url.href,
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
    }
  }
  throw new Error("Unable to resolve a hash-verified Blossom blob.");
}

function addServers(target: string[], servers: readonly string[]): void {
  for (const server of servers) {
    for (const origin of serverCandidates(server)) {
      if (!target.includes(origin)) target.push(origin);
    }
  }
}

function serverCandidates(value: string): string[] {
  if (value.trim() !== value || value === "")
    throw new Error("Blossom URI server hint is invalid.");
  const candidates = /^https?:\/\//u.test(value)
    ? [value]
    : [`https://${value}`, `http://${value}`];
  return candidates.map((candidate) => {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.hostname === "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== ""
    )
      throw new Error("Blossom URI server hint must name an HTTP(S) origin.");
    return url.origin;
  });
}

function positiveInteger(value: string): number {
  if (!/^[1-9][0-9]*$/u.test(value))
    throw new Error("Blossom URI size is invalid.");
  return positiveSize(Number(value));
}

function positiveSize(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("Blossom URI size is invalid.");
  return value;
}

function validContentLength(
  response: Response,
  reference: BlossomUriReference,
  maximum: number,
): boolean {
  const header = response.headers.get("Content-Length");
  if (header === null) return true;
  const length = Number(header);
  return (
    Number.isSafeInteger(length) &&
    length >= 0 &&
    length <= maximum &&
    (reference.size === undefined || length === reference.size)
  );
}

async function readBounded(
  response: Response,
  maximum: number,
): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) {
      await reader.cancel();
      throw new Error("Blossom blob exceeds the configured download limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
