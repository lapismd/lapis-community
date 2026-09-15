import { isBuzzDirectMetadata } from "./buzz-direct-messages.js";
import type { CommunityCommand, CommunityRoomScope } from "./contracts.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";

export function commandTemplates(
  command: CommunityCommand,
  createdAt: number,
  currentMetadata?: NostrEvent,
): readonly NostrEventTemplate[] {
  if (command.type === "direct-message" || command.type === "save-canvas")
    return [];
  if (command.type === "publish") return [command.template];
  if (command.type === "create-room" || command.type === "update-room") {
    const metadataContent = parseMetadataContent(currentMetadata?.content);
    const writerRestricted =
      command.update.postingPolicy === undefined
        ? currentMetadata?.tags.some((tag) => tag[0] === "write-restricted") ===
            true || metadataContent["write-restricted"] === true
        : command.update.postingPolicy === "writers";
    const content = {
      ...metadataContent,
      name: command.update.name.trim(),
      about: command.update.description.trim(),
      private: command.update.visibility === "private",
      "write-restricted": writerRestricted,
    };
    const preservedTags =
      command.type === "update-room"
        ? (currentMetadata?.tags ?? []).filter(
            (tag) =>
              ![
                "d",
                "h",
                "name",
                "about",
                "private",
                "write-restricted",
                "member_count",
              ].includes(tag[0] ?? ""),
          )
        : [];
    return [
      {
        kind: command.type === "create-room" ? 9_007 : 9_002,
        created_at: createdAt,
        content: JSON.stringify(content),
        tags: [
          ["h", command.groupId],
          ["name", command.update.name.trim()],
          ["about", command.update.description.trim()],
          ...preservedTags,
          ...(command.type === "create-room"
            ? [
                [
                  "supported_kinds",
                  ...(command.roomKind === "forum"
                    ? ["11", "1111", "7"]
                    : ["9", "7"]),
                ],
              ]
            : []),
          ...(command.update.visibility === "private" ? [["private"]] : []),
          ...(writerRestricted ? [["write-restricted"]] : []),
        ],
      },
    ];
  }
  if (command.type === "delete-room") {
    return [
      {
        kind: 9_008,
        created_at: createdAt,
        content: "",
        tags: [["h", command.groupId]],
      },
    ];
  }
  if (command.type === "delete") {
    return [
      {
        kind: command.mode === "moderator" ? 9_005 : 5,
        created_at: createdAt,
        content: "",
        tags: [
          ["e", command.eventId],
          ["h", command.groupId],
        ],
      },
    ];
  }
  if (command.type === "join" || command.type === "leave") {
    return [
      {
        kind: command.type === "join" ? 9_021 : 9_022,
        created_at: createdAt,
        content: "",
        tags: [
          ["h", command.groupId],
          ...(command.type === "join" && command.code !== undefined
            ? [["code", command.code]]
            : []),
        ],
      },
    ];
  }
  if (command.type === "add-member") {
    return [
      {
        kind: 9_000,
        created_at: createdAt,
        content: "",
        tags: [
          ["h", command.groupId],
          ["p", command.pubkey, ...(command.roles ?? [])],
        ],
      },
    ];
  }
  if (command.type === "create-invite") {
    return [
      {
        kind: 9_009,
        created_at: createdAt,
        content: "",
        tags: [
          ["h", command.groupId],
          ["code", command.code],
        ],
      },
    ];
  }
  return [
    {
      kind: 9_001,
      created_at: createdAt,
      content: "",
      tags: [
        ["h", command.groupId],
        ["p", command.pubkey],
      ],
    },
  ];
}

export function parseMetadataContent(
  value: string | undefined,
): Record<string, unknown> {
  if (value === undefined || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed !== null &&
      !Array.isArray(parsed) &&
      typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function roomScopeFromMetadata(
  metadata: NostrEvent,
): CommunityRoomScope {
  const groupId = metadata.tags.find((tag) => tag[0] === "d")?.[1];
  if (groupId === undefined || groupId === "") {
    throw new Error("Invite group metadata is missing its group ID");
  }
  const supportedKinds = new Set(
    metadata.tags
      .filter((tag) => tag[0] === "supported_kinds")
      .flatMap((tag) => tag.slice(1))
      .map(Number),
  );
  const compatibilityKind = metadata.tags.find(
    (tag) => tag[0] === "channel_type",
  )?.[1];
  const kind =
    supportedKinds.has(11) ||
    supportedKinds.has(1_111) ||
    compatibilityKind === "forum"
      ? "forum"
      : supportedKinds.has(9) ||
          compatibilityKind === "stream" ||
          compatibilityKind === "dm"
        ? "channel"
        : undefined;
  if (kind === undefined)
    throw new Error("Invite does not reference a supported room");
  const content = parseMetadataContent(metadata.content);
  const name =
    metadata.tags.find((tag) => tag[0] === "name")?.[1]?.trim() ||
    (typeof content.name === "string" ? content.name.trim() : "") ||
    groupId;
  const description =
    metadata.tags.find((tag) => tag[0] === "about")?.[1]?.trim() ||
    (typeof content.about === "string" ? content.about.trim() : "");
  return {
    id: groupId,
    groupId,
    name,
    kind,
    ...(isBuzzDirectMetadata(metadata)
      ? { transport: "buzz-dm" as const }
      : {}),
    ...(description === "" ? {} : { description }),
    private:
      metadata.tags.some((tag) => tag[0] === "private") ||
      content.private === true,
  };
}
