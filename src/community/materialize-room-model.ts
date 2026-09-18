import type { CommunityRoomScope } from "./contracts.js";
import type { NostrEvent } from "../protocol/index.js";
import type {
  CommunityDetailsModel,
  CommunityMemberModel,
  CommunityRoleDefinition,
  CommunityRoomModel,
} from "./workspace-model.js";
import { MAINTAINER_ROLE_DEFINITION } from "./channel-authority.js";
import {
  compareOldest,
  deletedEventIds,
  latestGroupRoleState,
  latestGroupState,
  parseJsonObject,
  type Profile,
  initials,
  shortKey,
} from "./materialize-shared.js";

export function roomModel(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  identityPubkey?: string,
): CommunityRoomModel {
  const metadata = latestGroupState(events, 39_000, room.groupId);
  const members = latestGroupState(events, 39_002, room.groupId);
  const admins = latestGroupState(events, 39_001, room.groupId);
  const rolesState = latestGroupRoleState(
    events,
    room.groupId,
    metadata?.pubkey,
  );
  const name =
    metadata?.tags.find((tag) => tag[0] === "name")?.[1] ?? room.name;
  const description =
    metadata?.tags.find((tag) => tag[0] === "about")?.[1] ?? room.description;
  const memberCount = members?.tags.filter((tag) => tag[0] === "p").length;
  const deleted = deletedEventIds(events);
  const messageEvents = events.filter(
    (event) =>
      !deleted.has(event.id) &&
      [9, 11, 1_111].includes(event.kind) &&
      event.tags.some((tag) => tag[0] === "h" && tag[1] === room.groupId),
  );
  const lastActivity = [
    ...messageEvents,
    ...(metadata === undefined ? [] : [metadata]),
  ].toSorted((left, right) => compareOldest(right, left))[0];
  const privateRoom =
    room.private === true ||
    metadata?.tags.some((tag) => tag[0] === "private") === true;
  const joined =
    identityPubkey === undefined
      ? undefined
      : members?.tags.some(
          (tag) => tag[0] === "p" && tag[1] === identityPubkey,
        );
  const administrator =
    identityPubkey !== undefined &&
    admins?.tags.some((tag) => tag[0] === "p" && tag[1] === identityPubkey) ===
      true;
  const memberRoles = normalizeRoles(
    members?.tags
      .filter((tag) => tag[0] === "p" && tag[1] === identityPubkey)
      .flatMap((tag) => tag.slice(2)) ?? [],
  );
  const metadataContent = parseJsonObject(metadata?.content);
  const membershipRequired =
    metadata?.tags.some(
      (tag) => tag[0] === "restricted" || tag[0] === "closed",
    ) === true ||
    metadataContent?.restricted === true ||
    metadataContent?.closed === true;
  const writerRequired =
    metadata?.tags.some((tag) => tag[0] === "write-restricted") === true ||
    metadataContent?.["write-restricted"] === true;
  const roleDefinitions = communityRoleDefinitions(metadata, rolesState);
  const authenticationRequired = {
    state: "requires-authentication" as const,
    reason: "Connect a NIP-07 identity to perform this action",
    requirement: "authentication" as const,
  };
  const denied = {
    state: "denied" as const,
    reason: "The relay has not granted permission for this room",
  };
  const enabled = { state: "enabled" as const };
  const membershipDenied = {
    state: "denied" as const,
    reason: "Join this room before posting",
    requirement: "membership" as const,
  };
  const reactionMembershipDenied = {
    state: "denied" as const,
    reason: "Join this room before reacting",
    requirement: "membership" as const,
  };
  const writerDenied = {
    state: "denied" as const,
    reason: "A writer or administrator role is required to publish here",
    requirement: "writer" as const,
  };
  const creator =
    identityPubkey !== undefined && metadata?.pubkey === identityPubkey;
  const canMaintain =
    administrator || creator || memberRoles.includes("maintainer");
  const maintainDenied = {
    state: "denied" as const,
    reason:
      "A maintainer or administrator role is required to create repositories and review or merge pull requests",
    requirement: "maintainer" as const,
  };
  const administrativeAvailability =
    identityPubkey === undefined
      ? authenticationRequired
      : admins === undefined || administrator
        ? enabled
        : denied;
  return {
    id: room.id,
    groupId: room.groupId,
    name,
    kind: room.kind,
    ...(description === undefined ? {} : { description }),
    ...(memberCount === undefined ? {} : { memberCount }),
    messageCount: messageEvents.length,
    private: privateRoom,
    postingPolicy: writerRequired ? "writers" : "standard",
    roleDefinitions,
    membership:
      members === undefined
        ? "unknown"
        : joined === true
          ? "joined"
          : "not-joined",
    memberListCompleteness: members === undefined ? "unavailable" : "partial",
    lifecycle: "ongoing",
    ...(lastActivity === undefined
      ? {}
      : {
          lastActivityAt: new Date(
            lastActivity.created_at * 1_000,
          ).toISOString(),
        }),
    permissions: {
      publish:
        identityPubkey === undefined
          ? authenticationRequired
          : membershipRequired && joined === false
            ? membershipDenied
            : writerRequired &&
                members !== undefined &&
                !administrator &&
                !memberRoles.includes("writer")
              ? writerDenied
              : enabled,
      react:
        identityPubkey === undefined
          ? authenticationRequired
          : membershipRequired && joined === false
            ? reactionMembershipDenied
            : enabled,
      join:
        identityPubkey === undefined
          ? authenticationRequired
          : joined === true
            ? denied
            : enabled,
      leave:
        identityPubkey === undefined
          ? authenticationRequired
          : joined === true
            ? enabled
            : denied,
      update: administrativeAvailability,
      delete: administrativeAvailability,
      manageMembers: administrativeAvailability,
      maintain:
        identityPubkey === undefined
          ? authenticationRequired
          : canMaintain
            ? enabled
            : maintainDenied,
    },
  };
}
export function memberModels(
  room: CommunityRoomScope | undefined,
  events: readonly NostrEvent[],
  profiles: ReadonlyMap<string, Profile>,
  statuses: ReadonlyMap<string, string>,
): CommunityMemberModel[] {
  const groupMembers =
    room === undefined
      ? undefined
      : latestGroupState(events, 39_002, room.groupId);
  const groupAdmins =
    room === undefined
      ? undefined
      : latestGroupState(events, 39_001, room.groupId);
  const roles = new Map<string, string[]>();
  const administratorIds = new Set<string>();
  for (const tag of groupMembers?.tags ?? []) {
    if (tag[0] === "p" && tag[1] !== undefined) {
      roles.set(
        tag[1],
        normalizeRoles([...(roles.get(tag[1]) ?? []), ...tag.slice(2)]),
      );
    }
  }
  for (const tag of groupAdmins?.tags ?? []) {
    if (tag[0] === "p" && tag[1] !== undefined) {
      administratorIds.add(tag[1]);
      roles.set(
        tag[1],
        normalizeRoles([...(roles.get(tag[1]) ?? []), ...tag.slice(2)]),
      );
    }
  }
  const pubkeys = new Set([
    ...roles.keys(),
    ...events.map((event) => event.pubkey),
    ...events.flatMap((event) =>
      event.tags
        .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
        .map((tag) => tag[1]!),
    ),
  ]);
  return [...pubkeys].toSorted().map((pubkey) => {
    const name = profiles.get(pubkey)?.name ?? shortKey(pubkey);
    return {
      id: pubkey,
      name,
      handle: shortKey(pubkey),
      initials: initials(name),
      ...(profiles.get(pubkey)?.picture === undefined
        ? {}
        : { avatarUrl: profiles.get(pubkey)!.picture! }),
      presence: "offline",
      ...(statuses.get(pubkey) === undefined
        ? {}
        : { status: statuses.get(pubkey)! }),
      ...(roles.get(pubkey) === undefined
        ? {}
        : {
            roles: roles.get(pubkey)!,
            role: administratorIds.has(pubkey)
              ? "administrator"
              : (roles.get(pubkey)?.[0] ?? "member"),
          }),
      ...(administratorIds.has(pubkey) ? { administrator: true } : {}),
    };
  });
}

export function communityRoleDefinitions(
  metadata: NostrEvent | undefined,
  rolesState: NostrEvent | undefined,
): CommunityRoleDefinition[] {
  const definitions = new Map<string, CommunityRoleDefinition>();
  if (metadata !== undefined && rolesState?.pubkey === metadata.pubkey) {
    for (const tag of rolesState.tags) {
      if (tag[0] !== "role" || tag[1]?.trim() === "") continue;
      const id = tag[1]!.trim();
      if (definitions.has(id)) continue;
      definitions.set(id, {
        id,
        label: roleLabel(id),
        ...(tag[2]?.trim() ? { description: tag[2]!.trim() } : {}),
      });
    }
  }
  if (!definitions.has("writer")) {
    definitions.set("writer", {
      id: "writer",
      label: "Writer",
      description: "Can publish when this room is limited to writers.",
    });
  }
  if (!definitions.has(MAINTAINER_ROLE_DEFINITION.id)) {
    definitions.set(MAINTAINER_ROLE_DEFINITION.id, {
      ...MAINTAINER_ROLE_DEFINITION,
    });
  }
  return [...definitions.values()].toSorted((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export function normalizeRoles(roles: readonly string[]): string[] {
  return [
    ...new Set(roles.map((role) => role.trim()).filter(Boolean)),
  ].toSorted();
}

export function roleLabel(role: string): string {
  return role
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => part[0]!.toLocaleUpperCase() + part.slice(1))
    .join(" ");
}
export function detailsModel(
  room: CommunityRoomScope,
  events: readonly NostrEvent[],
  members: readonly CommunityMemberModel[],
): CommunityDetailsModel {
  const metadata = latestGroupState(events, 39_000, room.groupId);
  const admins = latestGroupState(events, 39_001, room.groupId);
  return {
    description:
      metadata?.tags.find((tag) => tag[0] === "about")?.[1] ??
      room.description ??
      "",
    memberIds: members.map((member) => member.id),
    moderatorIds: (admins?.tags ?? [])
      .filter((tag) => tag[0] === "p" && tag[1] !== undefined)
      .map((tag) => tag[1]!),
  };
}
