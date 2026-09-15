<script lang="ts">
  import { AppShell } from "@lapismd/design-core/shell";
  import type { ComponentProps } from "svelte";

  import CommunitySettings from "../community-settings/CommunitySettings.svelte";

  let props: ComponentProps<typeof CommunitySettings> = $props();
</script>

<AppShell.Body layout="regions" label="Personal settings">
  <AppShell.Body.Content>
    <CommunitySettings {...props} />
  </AppShell.Body.Content>
</AppShell.Body>
