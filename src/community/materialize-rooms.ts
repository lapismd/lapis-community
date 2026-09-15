import { isBuzzDirectMetadata } from "./buzz-direct-messages.js";
import type { CommunityRoomScope, CommunityScope } from "./contracts.js";
import type { NostrEvent } from "../protocol/index.js";
import { isVerifiedNostrEvent } from "./verified-events.js";
import { newer } from "./materialize-shared.js";

export function communityRooms(
  scope: CommunityScope,
  events: readonly NostrEvent[] = [],
  identityPubkey?: string,
): readonly CommunityRoomScope[] {
  const configured =
    scope.rooms !== undefined && scope.rooms.length > 0
      ? [...scope.rooms]
      : scope.groupId === undefined || scope.groupId === ""
        ? []
        : [
            {
              id: scope.groupId,
              groupId: scope.groupId,
              name: scope.groupId,
              kind: "channel" as const,
            },
          ];
  // Calls without identity or events also inventory configured groups for relay queries.
  if (
    !scope.discoverPublicRooms &&
    events.length === 0 &&
    identityPubkey === undefined
  )
    return configured;

  const configuredGroupIds = new Set(configured.map((room) => room.groupId));
  const membershipsByGroup = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== 39_002 || !isVerifiedNostrEvent(event)) continue;
    const groupId = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (groupId === undefined || groupId === "") continue;
    const current = membershipsByGroup.get(groupId);
    if (current === undefined || newer(event, current)) {
      membershipsByGroup.set(groupId, event);
    }
  }
  const metadataByGroup = new Map<string, NostrEvent>();
  for (const event of events) {
    if (event.kind !== 39_000 || !isVerifiedNostrEvent(event)) continue;
    const groupId = event.tags.find((tag) => tag[0] === "d")?.[1];
    const privateRoom = event.tags.some(
      (tag) => tag[0] === "private" || tag[0] === "hidden",
    );
    const joined =
      identityPubkey !== undefined &&
      membershipsByGroup.get(groupId ?? "")?.pubkey === event.pubkey &&
      membershipsByGroup
        .get(groupId ?? "")
        ?.tags.some((tag) => tag[0] === "p" && tag[1] === identityPubkey) ===
        true;
    if (
      groupId === undefined ||
      groupId === "" ||
      configuredGroupIds.has(groupId) ||
      (privateRoom && !joined)
    ) {
      continue;
    }
    const current = metadataByGroup.get(groupId);
    if (current === undefined || newer(event, current)) {
      metadataByGroup.set(groupId, event);
    }
  }
  const discovered = [...metadataByGroup]
    .map(([groupId, metadata]): CommunityRoomScope | undefined => {
      const supportedKinds = new Set(
        metadata.tags
          .filter((tag) => tag[0] === "supported_kinds")
          .flatMap((tag) => tag.slice(1))
          .map(Number),
      );
      const buzzDirect = isBuzzDirectMetadata(metadata);
      const kind = buzzDirect
        ? "channel"
        : supportedKinds.has(11) || supportedKinds.has(1_111)
          ? "forum"
          : supportedKinds.has(9)
            ? "channel"
            : metadata.tags.find((tag) => tag[0] === "channel_type")?.[1] ===
                "forum"
              ? "forum"
              : metadata.tags.find((tag) => tag[0] === "channel_type")?.[1] ===
                  "stream"
                ? "channel"
                : undefined;
      if (kind === undefined) return undefined;
      const name =
        metadata.tags.find((tag) => tag[0] === "name")?.[1]?.trim() || groupId;
      const description = metadata.tags
        .find((tag) => tag[0] === "about")?.[1]
        ?.trim();
      const privateRoom = metadata.tags.some(
        (tag) => tag[0] === "private" || tag[0] === "hidden",
      );
      return {
        id: groupId,
        groupId,
        name,
        kind,
        ...(buzzDirect ? { transport: "buzz-dm" as const } : {}),
        ...(description ? { description } : {}),
        ...(privateRoom ? { private: true } : {}),
      };
    })
    .filter((room): room is CommunityRoomScope => room !== undefined)
    .toSorted(
      (left, right) =>
        left.kind.localeCompare(right.kind) ||
        left.name.localeCompare(right.name),
    );
  const visibleConfigured = configured.filter((room) => {
    const metadata = events
      .filter(
        (event) =>
          event.kind === 39000 &&
          isVerifiedNostrEvent(event) &&
          event.tags.some((tag) => tag[0] === "d" && tag[1] === room.groupId),
      )
      .toSorted(
        (a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id),
      )[0];
    const privateRoom =
      room.private ||
      room.transport === "buzz-dm" ||
      metadata?.tags.some((tag) => tag[0] === "private" || tag[0] === "hidden");
    if (!privateRoom) return true;
    const membership = membershipsByGroup.get(room.groupId);
    return (
      !!identityPubkey &&
      !!metadata &&
      membership?.pubkey === metadata.pubkey &&
      membership.tags.some((tag) => tag[0] === "p" && tag[1] === identityPubkey)
    );
  });
  return [
    ...visibleConfigured,
    ...(scope.discoverPublicRooms ? discovered : []),
  ];
}
