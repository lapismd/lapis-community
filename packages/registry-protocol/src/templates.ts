import { canonicalJson } from "./canonical.js";
import { eventAddress } from "./tags.js";
import type {
  ApprovalContent,
  AssessmentContent,
  ModerationContent,
  NostrEventTemplate,
  PluginDefinitionContent,
  RegistryKindMap,
  ReleaseContent,
  RevocationContent,
  SnapshotContent,
} from "./types.js";

function template(
  kind: number,
  createdAt: number,
  tags: string[][],
  content: object,
): NostrEventTemplate {
  return {
    kind,
    created_at: createdAt,
    tags,
    content: canonicalJson(
      content as unknown as import("./types.js").JsonValue,
    ),
  };
}

export function createPluginEventTemplate(
  content: PluginDefinitionContent,
  kinds: RegistryKindMap,
  createdAt: number,
): NostrEventTemplate {
  return template(
    kinds.softwareApplication,
    createdAt,
    [["d", content.pluginId]],
    content,
  );
}

export function createReleaseEventTemplate(
  content: ReleaseContent,
  publisherPubkey: string,
  kinds: RegistryKindMap,
  createdAt: number,
): NostrEventTemplate {
  return template(
    kinds.releaseArtifactSet,
    createdAt,
    [
      ["d", `${content.pluginId}@${content.version}`],
      [
        "a",
        eventAddress(
          kinds.softwareApplication,
          publisherPubkey,
          content.pluginId,
        ),
      ],
      ["x", content.artifact.sha256],
    ],
    content,
  );
}

export function createAssessmentEventTemplate(
  content: AssessmentContent,
  kinds: RegistryKindMap,
  createdAt: number,
): NostrEventTemplate {
  return template(
    kinds.assessmentLabel,
    createdAt,
    [
      ["e", content.releaseEventId, "", "release"],
      ["x", content.artifactSha256],
    ],
    content,
  );
}

export function createApprovalEventTemplate(
  content: ApprovalContent,
  kinds: RegistryKindMap,
  createdAt: number,
): NostrEventTemplate {
  return template(
    kinds.approval,
    createdAt,
    [
      ["d", `${content.pluginId}@${content.version}`],
      ["e", content.releaseEventId, "", "release"],
      ["e", content.assessmentEventId, "", "assessment"],
      ["x", content.artifactSha256],
    ],
    content,
  );
}

export function createRevocationEventTemplate(
  content: RevocationContent,
  kinds: RegistryKindMap,
  createdAt: number,
): NostrEventTemplate {
  let targetTag: string[];
  switch (content.target.scope) {
    case "artifact":
      targetTag = ["x", content.target.sha256];
      break;
    case "plugin":
      targetTag = ["d", content.target.pluginId];
      break;
    case "publisher":
      targetTag = ["p", content.target.pubkey];
      break;
    case "release":
      targetTag = ["e", content.target.releaseEventId, "", "release"];
      break;
  }
  return template(kinds.revocation, createdAt, [targetTag], content);
}

export function createModerationEventTemplate(
  content: ModerationContent,
  kinds: RegistryKindMap,
  createdAt: number,
): NostrEventTemplate {
  let targetTag: string[];
  switch (content.target.type) {
    case "event":
      targetTag = ["e", content.target.eventId];
      break;
    case "plugin":
      targetTag = ["d", content.target.pluginId];
      break;
    case "publisher":
      targetTag = ["p", content.target.pubkey];
      break;
  }
  return template(kinds.moderationDecision, createdAt, [targetTag], content);
}

export function createSnapshotEventTemplate(
  content: SnapshotContent,
  kinds: RegistryKindMap,
  createdAt: number,
): NostrEventTemplate {
  return template(
    kinds.snapshot,
    createdAt,
    [
      ["d", "official"],
      ["x", content.root],
    ],
    content,
  );
}
