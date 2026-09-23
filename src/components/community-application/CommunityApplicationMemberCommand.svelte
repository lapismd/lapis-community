<script lang="ts">
  import CommunityMemberCommand from "../community-member-command/CommunityMemberCommand.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { ProjectTaskState } from "../../projects/index.js";
  import { memberCommandTitle } from "./member-command-room.js";

  let {
    open = $bindable(false),
    mode,
    room,
    members,
    results,
    groupMemberIds,
    currentMemberId,
    selectedIds,
    task,
    canSetRoles = false,
    onSearch,
    onSelect,
    onRemove,
    onSetRoles,
    onConfirm,
  }: {
    open?: boolean;
    mode: "view" | "manage" | "select";
    room: CommunityRoomModel;
    members: readonly CommunityMemberModel[];
    results: readonly CommunityMemberModel[];
    groupMemberIds: readonly string[];
    currentMemberId?: string | undefined;
    selectedIds: readonly string[];
    task?: ProjectTaskState | undefined;
    canSetRoles?: boolean | undefined;
    onSearch: (query: string) => void;
    onSelect: (member: CommunityMemberModel) => void;
    onRemove: (member: CommunityMemberModel) => void;
    onSetRoles?: (
      member: CommunityMemberModel,
      roles: readonly string[],
    ) => Promise<void>;
    onConfirm: () => void;
  } = $props();
</script>

<CommunityMemberCommand
  bind:open
  title={memberCommandTitle(mode, task?.title, room.kind)}
  {mode}
  {members}
  {results}
  {groupMemberIds}
  {...currentMemberId === undefined ? {} : { currentMemberId }}
  roomKind={room.kind === "direct" ? "conversation" : room.kind}
  {selectedIds}
  selectionLabel={mode === "select" && task
    ? "Selected assignees"
    : "Selected recipients"}
  confirmLabel={mode === "select" && task
    ? "Update assignees"
    : "Start message"}
  allowEmptySelection={mode === "select" && task !== undefined}
  completeness={room.memberListCompleteness ?? "unavailable"}
  roleDefinitions={room.roleDefinitions ?? []}
  {onSearch}
  {onSelect}
  {onRemove}
  {...canSetRoles && onSetRoles ? { onSetRoles } : {}}
  {onConfirm}
/>
