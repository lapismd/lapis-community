import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { verifyEvent } from "nostr-tools/pure";

import { fetchNip29ReleaseManifestDocuments } from "../nostr/index.js";
import type {
  Nip29ReleaseManifestDocument,
  RelayAuthSigner,
} from "../nostr/index.js";
import {
  getNip29ManifestAttachment,
  isNip29PublisherAuthorized,
  LAPIS_GROUPS,
  LAPIS_RELEASE_TOPIC,
  lapisGroupId,
  NIP29_KINDS,
  type Nip29RegistryAuthorities,
  type NostrEvent,
} from "../protocol/index.js";
import type { RegistryEventSnapshot } from "./snapshot-store.js";

export interface RegistryManifestHydrationOptions {
  authorities: Nip29RegistryAuthorities;
  manifestBytes: Map<string, Uint8Array>;
  fetch: typeof globalThis.fetch;
  mediaAuthSigner: RelayAuthSigner;
  relayUrls: readonly string[];
  blossomUrls: readonly URL[];
  signal: AbortSignal;
}

export async function hydrateRegistryManifestDocuments(
  events: readonly NostrEvent[],
  options: RegistryManifestHydrationOptions,
): Promise<Nip29ReleaseManifestDocument[]> {
  const authorized = authorizedReleaseEvents(events, options.authorities);
  const documents = new Map<string, Nip29ReleaseManifestDocument>();
  const missing: NostrEvent[] = [];
  for (const event of authorized) {
    const attachment = getNip29ManifestAttachment(event);
    if (attachment === undefined) continue;
    const bytes = options.manifestBytes.get(attachment.sha256);
    if (bytes === undefined) {
      missing.push(event);
      continue;
    }
    try {
      documents.set(
        attachment.sha256,
        manifestDocument(attachment.sha256, bytes, attachment.size),
      );
    } catch {
      options.manifestBytes.delete(attachment.sha256);
      missing.push(event);
    }
  }
  if (missing.length > 0) {
    const fetched = await fetchNip29ReleaseManifestDocuments(missing, {
      fetch: options.fetch,
      mediaAuthSigner: options.mediaAuthSigner,
      relayUrls: options.relayUrls,
      blossomUrls: options.blossomUrls,
      signal: options.signal,
    });
    for (const document of fetched) {
      options.manifestBytes.set(document.attachmentSha256, document.bytes);
      documents.set(document.attachmentSha256, document);
    }
  }
  return [...documents.values()].toSorted((left, right) =>
    left.attachmentSha256.localeCompare(right.attachmentSha256),
  );
}

export function verifiedSnapshotDocuments(
  snapshot: RegistryEventSnapshot,
  authorities: Nip29RegistryAuthorities,
): Nip29ReleaseManifestDocument[] {
  if (snapshot.events.some((event) => !verifyEvent(event))) {
    throw new Error("Cached registry snapshot contains an invalid event");
  }
  const attachments = new Map(
    authorizedReleaseEvents(snapshot.events, authorities).flatMap((event) => {
      const attachment = getNip29ManifestAttachment(event);
      return attachment === undefined
        ? []
        : [[attachment.sha256, attachment] as const];
    }),
  );
  const documents = snapshot.manifests.map((manifest) => {
    const attachment = attachments.get(manifest.attachmentSha256);
    if (attachment === undefined) {
      throw new Error("Cached registry manifest has no signed attachment");
    }
    return manifestDocument(
      manifest.attachmentSha256,
      manifest.bytes,
      attachment.size,
    );
  });
  if (documents.length !== attachments.size) {
    throw new Error("Cached registry snapshot is missing a manifest");
  }
  return documents;
}

export function manifestDocument(
  attachmentSha256: string,
  bytes: Uint8Array,
  expectedSize: number,
): Nip29ReleaseManifestDocument {
  if (bytes.byteLength !== expectedSize || digest(bytes) !== attachmentSha256) {
    throw new Error(`Release manifest ${attachmentSha256} failed verification`);
  }
  return {
    attachmentSha256,
    bytes,
    manifest: JSON.parse(new TextDecoder().decode(bytes)) as unknown,
  };
}

export function authorizedReleaseEvents(
  events: readonly NostrEvent[],
  authorities: Nip29RegistryAuthorities | undefined,
): NostrEvent[] {
  const releaseGroupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);
  return events.filter((event) => {
    if (
      event.kind !== NIP29_KINDS.streamMessage ||
      event.tags.find((tag) => tag[0] === "h")?.[1] !== releaseGroupId ||
      !event.tags.some(
        (tag) => tag[0] === "t" && tag[1] === LAPIS_RELEASE_TOPIC,
      )
    ) {
      return false;
    }
    if (authorities === undefined) return true;
    const pluginTopics = event.tags
      .filter((tag) => tag[0] === "t" && tag[1]?.startsWith("plugin:") === true)
      .map((tag) => tag[1]!.slice("plugin:".length));
    if (pluginTopics.length !== 1) return false;
    return isNip29PublisherAuthorized(
      events,
      authorities,
      pluginTopics[0]!,
      event.pubkey,
    );
  });
}

export function digest(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}
