import type {
  MaterializedNip29Release,
  NostrReleaseProof,
} from "../protocol/index.js";

export function createNip29ReleaseProof(
  pluginId: string,
  version: string,
  release: MaterializedNip29Release,
  bytes: Uint8Array | undefined,
): NostrReleaseProof {
  if (release.authorizationEvent === undefined) {
    throw new Error(
      `${pluginId}@${version}: portable proof requires a signed publisher authorization`,
    );
  }
  if (bytes === undefined) {
    throw new Error(`${pluginId}@${version}: release manifest is unavailable`);
  }
  const manifest = {
    sha256: release.attachment.sha256,
    size: bytes.byteLength,
    content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  };
  return release.head === undefined
    ? {
        schema: "lapis.plugin.release-proof/1",
        authorizationEvent: release.authorizationEvent,
        releaseEvent: release.event,
        decisionEvent: release.decisionEvent,
        manifest,
      }
    : {
        schema: "lapis.plugin.release-proof/2",
        authorizationEvent: release.authorizationEvent,
        releaseEvent: release.event,
        decisionEvent: release.decisionEvent,
        headEvent: release.head.event,
        manifest,
      };
}
