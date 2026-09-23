<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import RotateIcon from "@lucide/svelte/icons/rotate-ccw";
  import CommunityProfileActions from "../community-profile-actions/CommunityProfileActions.svelte";
  import { activityControlHeading } from "./activity-run-label.js";
  import type { CommunityAgentControllerScope } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";

  let {
    scope,
    rooms,
    showReset,
    disabled,
    onCancel,
    onReset,
  }: {
    scope: CommunityAgentControllerScope;
    rooms: readonly CommunityRoomModel[];
    showReset: boolean;
    disabled: boolean;
    onCancel?: () => Promise<void>;
    onReset?: () => void;
  } = $props();
  const heading = $derived(activityControlHeading(scope, rooms));
</script>

<details class="activity-run" open>
  <summary>{heading}</summary>
  {#if (scope.active && onCancel) || (showReset && onReset)}
    <CommunityProfileActions label={`Actions for ${heading}`}>
      {#if scope.active && onCancel}<Button
          variant="outline"
          {disabled}
          onclick={() => onCancel().catch(() => {})}
          ><CircleStopIcon aria-hidden="true" />Cancel turn</Button
        >{/if}
      {#if showReset && onReset}<Button
          variant="outline"
          {disabled}
          onclick={onReset}
          ><RotateIcon aria-hidden="true" />Reset conversation</Button
        >{/if}
    </CommunityProfileActions>
  {/if}
</details>

<style>
  .activity-run {
    display: grid;
    gap: 0.875rem;
  }
  summary {
    cursor: pointer;
    color: var(--muted-foreground);
  }
</style>
