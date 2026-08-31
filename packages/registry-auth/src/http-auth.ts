import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { verifyEvent } from "nostr-tools/pure";

import { nostrEventSchema } from "@lapismd/registry-protocol";
import type { NostrEvent } from "@lapismd/registry-protocol";

import type { NostrEventTemplate } from "./types.js";

export const NIP98_HTTP_AUTH_KIND = 27235;

export interface HttpAuthTemplateOptions {
  url: string;
  method: string;
  body?: string | Uint8Array | undefined;
  challenge?: string | undefined;
  createdAt?: number | undefined;
}

export interface HttpAuthVerificationOptions extends HttpAuthTemplateOptions {
  now?: number | undefined;
  maxAgeSeconds?: number | undefined;
  maxFutureSkewSeconds?: number | undefined;
}

export class HttpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpAuthError";
  }
}

function bodyBytes(body: string | Uint8Array): Uint8Array {
  return typeof body === "string" ? new TextEncoder().encode(body) : body;
}

function tag(event: NostrEvent, name: string): string | undefined {
  const values = event.tags.filter((candidate) => candidate[0] === name);
  if (values.length !== 1) return undefined;
  return values[0]?.[1];
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Decode(value: string): string {
  const binary = atob(value);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

export function createHttpAuthTemplate(
  options: HttpAuthTemplateOptions,
): NostrEventTemplate {
  const tags = [
    ["u", new URL(options.url).toString()],
    ["method", options.method.toUpperCase()],
  ];
  if (options.body !== undefined) {
    tags.push(["payload", bytesToHex(sha256(bodyBytes(options.body)))]);
  }
  if (options.challenge !== undefined) {
    tags.push(["challenge", options.challenge]);
  }
  return {
    kind: NIP98_HTTP_AUTH_KIND,
    created_at: options.createdAt ?? Math.floor(Date.now() / 1_000),
    tags,
    content: "",
  };
}

export function toNip98AuthorizationHeader(event: NostrEvent): string {
  return `Nostr ${base64Encode(JSON.stringify(event))}`;
}

export function parseNip98AuthorizationHeader(header: string): NostrEvent {
  const [scheme, encoded, extra] = header.trim().split(/\s+/u);
  if (scheme !== "Nostr" || encoded === undefined || extra !== undefined) {
    throw new HttpAuthError("Expected a Nostr authorization scheme");
  }
  try {
    return nostrEventSchema.parse(JSON.parse(base64Decode(encoded)));
  } catch {
    throw new HttpAuthError("Nostr authorization event is malformed");
  }
}

export function verifyHttpAuth(
  event: NostrEvent,
  options: HttpAuthVerificationOptions,
): string {
  const now = options.now ?? Math.floor(Date.now() / 1_000);
  const maxAge = options.maxAgeSeconds ?? 60;
  const maxFutureSkew = options.maxFutureSkewSeconds ?? 5;
  if (event.kind !== NIP98_HTTP_AUTH_KIND || event.content !== "") {
    throw new HttpAuthError("HTTP authorization kind or content is invalid");
  }
  if (
    event.created_at < now - maxAge ||
    event.created_at > now + maxFutureSkew
  ) {
    throw new HttpAuthError(
      "HTTP authorization event is outside the freshness window",
    );
  }
  if (!verifyEvent(event)) {
    throw new HttpAuthError("HTTP authorization signature is invalid");
  }
  if (tag(event, "u") !== new URL(options.url).toString()) {
    throw new HttpAuthError("HTTP authorization URL does not match");
  }
  if (tag(event, "method") !== options.method.toUpperCase()) {
    throw new HttpAuthError("HTTP authorization method does not match");
  }
  if (options.body !== undefined) {
    const expected = bytesToHex(sha256(bodyBytes(options.body)));
    if (tag(event, "payload") !== expected) {
      throw new HttpAuthError("HTTP authorization payload does not match");
    }
  }
  if (
    options.challenge !== undefined &&
    tag(event, "challenge") !== options.challenge
  ) {
    throw new HttpAuthError("HTTP authorization challenge does not match");
  }
  return event.pubkey;
}
