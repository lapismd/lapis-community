import type {
  ApprovalContent,
  AssessmentContent,
  ModerationContent,
  NostrEvent,
  PluginDefinitionContent,
  RegistryKindMap,
  ReleaseContent,
  RevocationContent,
  SnapshotContent,
} from "./types.js";

function hasTag(
  event: NostrEvent,
  name: string,
  value: string,
  marker?: string,
): boolean {
  return event.tags.some(
    (tag) =>
      tag[0] === name &&
      tag[1] === value &&
      (marker === undefined || tag[3] === marker),
  );
}

export function eventAddress(
  kind: number,
  pubkey: string,
  identifier: string,
): string {
  return `${kind}:${pubkey}:${identifier}`;
}

export function validatePluginTags(
  event: NostrEvent,
  content: PluginDefinitionContent,
): boolean {
  return hasTag(event, "d", content.pluginId);
}

export function validateReleaseTags(
  event: NostrEvent,
  content: ReleaseContent,
  kinds: RegistryKindMap,
): boolean {
  return (
    hasTag(event, "d", `${content.pluginId}@${content.version}`) &&
    hasTag(
      event,
      "a",
      eventAddress(kinds.softwareApplication, event.pubkey, content.pluginId),
    ) &&
    hasTag(event, "x", content.artifact.sha256)
  );
}

export function validateAssessmentTags(
  event: NostrEvent,
  content: AssessmentContent,
): boolean {
  return (
    hasTag(event, "e", content.releaseEventId, "release") &&
    hasTag(event, "x", content.artifactSha256)
  );
}

export function validateApprovalTags(
  event: NostrEvent,
  content: ApprovalContent,
): boolean {
  return (
    hasTag(event, "e", content.releaseEventId, "release") &&
    hasTag(event, "e", content.assessmentEventId, "assessment") &&
    hasTag(event, "x", content.artifactSha256) &&
    hasTag(event, "d", `${content.pluginId}@${content.version}`)
  );
}

export function validateRevocationTags(
  event: NostrEvent,
  content: RevocationContent,
): boolean {
  switch (content.target.scope) {
    case "artifact":
      return hasTag(event, "x", content.target.sha256);
    case "plugin":
      return hasTag(event, "d", content.target.pluginId);
    case "publisher":
      return hasTag(event, "p", content.target.pubkey);
    case "release":
      return hasTag(event, "e", content.target.releaseEventId, "release");
  }
}

export function validateModerationTags(
  event: NostrEvent,
  content: ModerationContent,
): boolean {
  switch (content.target.type) {
    case "event":
      return hasTag(event, "e", content.target.eventId);
    case "plugin":
      return hasTag(event, "d", content.target.pluginId);
    case "publisher":
      return hasTag(event, "p", content.target.pubkey);
  }
}

export function validateSnapshotTags(
  event: NostrEvent,
  content: SnapshotContent,
): boolean {
  return hasTag(event, "d", "official") && hasTag(event, "x", content.root);
}
