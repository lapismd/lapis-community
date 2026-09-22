<script lang="ts">
  import { CommunityProfileActions } from "@lapismd/lapis-community/components";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import RotateIcon from "@lucide/svelte/icons/rotate-ccw";
  let cancelled = $state(false);
</script>

<div style="width: 40rem">
  <CommunityProfileActions label="Agent actions">
    <Button variant="outline" onclick={() => (cancelled = true)}
      ><CircleStopIcon aria-hidden="true" />Cancel turn</Button
    >
    <Button variant="outline"
      ><RotateIcon aria-hidden="true" />Reset conversation</Button
    >
  </CommunityProfileActions>
  {#if cancelled}<p role="status">Cancellation requested</p>{/if}
</div>
