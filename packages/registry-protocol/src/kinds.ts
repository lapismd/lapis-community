import type { RegistryKindMap } from "./types.js";

export const STANDARD_REGISTRY_KINDS = Object.freeze({
  softwareApplication: 32267,
  releaseArtifactSet: 30063,
  assessmentLabel: 1985,
  moderationReport: 1984,
  fileMetadata: 1063,
  comment: 1111,
});

/**
 * Fixture-only allocation. The workflow kinds have not been registered and
 * must not be used for public events.
 */
export const TEST_REGISTRY_KINDS: RegistryKindMap = Object.freeze({
  ...STANDARD_REGISTRY_KINDS,
  approval: 64000,
  revocation: 64001,
  snapshot: 64002,
});

export function createRegistryKindMap(
  workflowKinds: Pick<RegistryKindMap, "approval" | "revocation" | "snapshot">,
): RegistryKindMap {
  const kinds = { ...STANDARD_REGISTRY_KINDS, ...workflowKinds };
  const values = Object.values(kinds);

  if (
    values.some((kind) => !Number.isInteger(kind) || kind < 0 || kind > 65535)
  ) {
    throw new Error("Registry kinds must be integers between 0 and 65535");
  }

  if (new Set(values).size !== values.length) {
    throw new Error("Registry kinds must be unique");
  }

  return Object.freeze(kinds);
}
