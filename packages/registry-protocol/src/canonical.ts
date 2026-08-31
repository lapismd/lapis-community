import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import type { JsonObject, JsonValue } from "./types.js";

function normalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]),
    );
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Canonical JSON cannot contain non-finite numbers");
  }

  return value;
}

export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(normalize(value));
}

export function canonicalHash(value: JsonObject): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonicalJson(value))));
}
