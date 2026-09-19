<script lang="ts">
  import { CommunityProfileActions } from "@lapismd/lapis-community/components";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import RotateIcon from "@lucide/svelte/icons/rotate-ccw";
  let cancelled = $state(false);
</script>

<div style="width: 280px">
  <CommunityProfileActions label="Agent actions">
    <Button variant="secondary" onclick={() => (cancelled = true)}
      ><CircleStopIcon aria-hidden="true" />Cancel turn</Button
    >
    <Button variant="secondary"
      ><RotateIcon aria-hidden="true" />Reset conversation</Button
    >
  </CommunityProfileActions>
  {#if cancelled}<p role="status">Cancellation requested</p>{/if}
</div>
