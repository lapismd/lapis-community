import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { verifyEvent } from "nostr-tools/pure";

import {
  nip29ReleaseManifestSchema,
  nostrReleaseProofSchema,
} from "./schemas.js";
import {
  parseNip29CuratorDecision,
  parseNip29PublisherAuthorization,
  parseNip29ReleaseEvent,
} from "./nip29.js";
import type {
  NostrEvent,
  NostrReleaseArtifactReference,
  NostrReleaseProof,
  VerifiedNostrReleaseProof,
} from "./types.js";

export type NostrReleaseProofErrorCode =
  | "metadata-invalid"
  | "signature-invalid"
  | "authority-invalid"
  | "manifest-invalid"
  | "artifact-invalid"
  | "decision-invalid";

export class NostrReleaseProofError extends Error {
  readonly code: NostrReleaseProofErrorCode;

  constructor(code: NostrReleaseProofErrorCode, message: string) {
    super(message);
    this.name = "NostrReleaseProofError";
    this.code = code;
  }
}

export interface VerifyNostrReleaseProofOptions {
  /** Exact bytes for installation, or a previously verified digest for freshness checks. */
  artifact: Uint8Array | NostrReleaseArtifactReference;
  trustedCuratorPubkeys: ReadonlySet<string>;
  verifySignature?: ((event: NostrEvent) => boolean) | undefined;
}

export function parseNostrReleaseProof(value: unknown): NostrReleaseProof {
  const parsed = nostrReleaseProofSchema.safeParse(value);
  if (!parsed.success) {
    throw new NostrReleaseProofError(
      "metadata-invalid",
      "Nostr release proof has an invalid envelope",
    );
  }
  return parsed.data;
}

export function verifyNostrReleaseProof(
  value: unknown,
  options: VerifyNostrReleaseProofOptions,
): VerifiedNostrReleaseProof {
  const proof = parseNostrReleaseProof(value);
  const verifySignature = options.verifySignature ?? verifyEvent;
  for (const event of [
    proof.authorizationEvent,
    proof.releaseEvent,
    proof.decisionEvent,
  ]) {
    if (!verifySignature(event)) {
      throw new NostrReleaseProofError(
        "signature-invalid",
        `Nostr event ${event.id} failed signature verification`,
      );
    }
  }

  const authorization = parseNip29PublisherAuthorization(
    proof.authorizationEvent,
  );
  if (
    authorization === undefined ||
    authorization.status !== "authorized" ||
    !options.trustedCuratorPubkeys.has(proof.authorizationEvent.pubkey)
  ) {
    throw new NostrReleaseProofError(
      "authority-invalid",
      "Publisher authorization is missing, revoked, malformed, or not signed by a trusted curator",
    );
  }

  const release = parseNip29ReleaseEvent(proof.releaseEvent);
  if (
    release === undefined ||
    release.pluginId !== authorization.pluginId ||
    proof.releaseEvent.pubkey !== authorization.publisherPubkey
  ) {
    throw new NostrReleaseProofError(
      "authority-invalid",
      "Release event does not match its publisher authorization",
    );
  }

  const manifestBytes = new TextEncoder().encode(proof.manifest.content);
  if (
    proof.manifest.sha256 !== release.attachment.sha256 ||
    proof.manifest.size !== release.attachment.size ||
    manifestBytes.byteLength !== proof.manifest.size ||
    digest(manifestBytes) !== proof.manifest.sha256
  ) {
    throw new NostrReleaseProofError(
      "manifest-invalid",
      "Release manifest bytes do not match the signed NIP-92 attachment",
    );
  }

  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(proof.manifest.content) as unknown;
  } catch {
    throw new NostrReleaseProofError(
      "manifest-invalid",
      "Release manifest is not valid JSON",
    );
  }
  const manifest = nip29ReleaseManifestSchema.safeParse(manifestValue);
  if (
    !manifest.success ||
    manifest.data.plugin.pluginId !== release.pluginId ||
    manifest.data.release.pluginId !== release.pluginId
  ) {
    throw new NostrReleaseProofError(
      "manifest-invalid",
      "Release manifest is invalid or names another plugin",
    );
  }

  const expectedArtifact = manifest.data.release.artifact;
  const suppliedArtifact =
    options.artifact instanceof Uint8Array
      ? {
          sha256: digest(options.artifact),
          size: options.artifact.byteLength,
        }
      : options.artifact;
  if (
    !/^[0-9a-f]{64}$/u.test(suppliedArtifact.sha256) ||
    !Number.isSafeInteger(suppliedArtifact.size) ||
    suppliedArtifact.size < 0 ||
    suppliedArtifact.size !== expectedArtifact.size ||
    suppliedArtifact.sha256 !== expectedArtifact.sha256
  ) {
    throw new NostrReleaseProofError(
      "artifact-invalid",
      "Plugin artifact bytes do not match the curated release manifest",
    );
  }

  const decision = parseNip29CuratorDecision(
    proof.decisionEvent,
    proof.releaseEvent.id,
  );
  if (
    decision === undefined ||
    decision.decision !== "approved" ||
    proof.decisionEvent.created_at < proof.releaseEvent.created_at ||
    proof.authorizationEvent.created_at > proof.decisionEvent.created_at ||
    !options.trustedCuratorPubkeys.has(proof.decisionEvent.pubkey)
  ) {
    throw new NostrReleaseProofError(
      "decision-invalid",
      "Release approval is missing, malformed, stale, or not signed by a trusted curator",
    );
  }

  return {
    pluginId: release.pluginId,
    version: manifest.data.release.version,
    authorizationEventId: proof.authorizationEvent.id,
    releaseEventId: proof.releaseEvent.id,
    decisionEventId: proof.decisionEvent.id,
    manifestSha256: proof.manifest.sha256,
    artifactSha256: expectedArtifact.sha256,
    artifactSize: expectedArtifact.size,
    requiresRelayRefresh: true,
    manifest: manifest.data,
  };
}

function digest(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}
