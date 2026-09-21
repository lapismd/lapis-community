<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import { activityContextLabel } from "../../community/agent-activity-context.js";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentActivityItem,
    CommunityAgentIdentity,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";

  let {
    selected,
    context,
    rooms = [],
    lastActivity,
    model,
    onLatest,
  }: {
    selected?: CommunityAgentIdentity;
    context: CommunityAgentActivityContext;
    rooms?: readonly CommunityRoomModel[];
    lastActivity?: CommunityAgentActivityItem;
    model: Pick<
      CommunityAgentsState,
      "activityLoading" | "activitySyncStatus" | "capabilities" | "status"
    >;
    onLatest: () => void | Promise<void>;
  } = $props();
</script>

<div class="agent-activity__identity">
  {#if selected}<CommunityMemberAvatar
      member={{
        id: selected.pubkey,
        name: selected.name,
        handle: selected.pubkey,
        initials: selected.name.slice(0, 2),
        ...(selected.avatarUrl ? { avatarUrl: selected.avatarUrl } : {}),
      }}
      size="small"
      shape="rounded"
      decorative
    />{/if}
  <div>
    <h2>{selected?.name ?? "Agent activity"}</h2>
    <p>{activityContextLabel(context, rooms)}</p>
    {#if lastActivity}<small
        >Last updated <CommunityRelativeTime
          timestamp={Date.parse(lastActivity.frame.timestamp) / 1000}
        /></small
      >{/if}
  </div>
</div>
<div class="agent-activity__toolbar">
  <CommunityChip
    size="compact"
    tone={model.activitySyncStatus === "caught-up" ||
    (model.status === "ready" && model.capabilities.activity)
      ? "success"
      : "warning"}
    >{model.activitySyncStatus === "checking"
      ? "Checking activity"
      : model.activitySyncStatus === "caught-up"
        ? "Caught up"
        : model.activitySyncStatus === "unavailable"
          ? "Catch-up unavailable"
          : model.status === "ready" && model.capabilities.activity
            ? "Live capture"
            : "Saved history"}</CommunityChip
  ><Button
    variant="ghost"
    size="sm"
    onclick={() => void onLatest()}
    disabled={model.activityLoading}
    ><RefreshIcon aria-hidden="true" />Latest</Button
  >
</div>

<style>
  .agent-activity__identity {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .agent-activity__identity h2,
  .agent-activity__identity p {
    margin: 0;
  }
  .agent-activity__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  p {
    margin: 0;
    color: var(--muted-foreground);
    line-height: 1.5;
  }
</style>
