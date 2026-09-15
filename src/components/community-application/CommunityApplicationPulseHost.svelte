<script lang="ts">
  import { AppShell } from "@lapismd/design-core/shell";
  import type { ComponentProps } from "svelte";

  import CommunityPulse from "../community-pulse/CommunityPulse.svelte";

  let props: ComponentProps<typeof CommunityPulse> = $props();
</script>

<AppShell.Body layout="regions" label="Pulse">
  <AppShell.Body.Content label="Pulse feed">
    <CommunityPulse {...props} />
  </AppShell.Body.Content>
</AppShell.Body>
