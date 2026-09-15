<script lang="ts">
  import { AppShell } from "@lapismd/design-core/shell";
  import type { ComponentProps } from "svelte";

  import CommunityDirectMessageComposer from "../community-direct-message-composer/CommunityDirectMessageComposer.svelte";

  let props: ComponentProps<typeof CommunityDirectMessageComposer> = $props();
</script>

<AppShell.Body layout="regions" label="New direct message">
  <AppShell.Body.Content>
    <CommunityDirectMessageComposer {...props} />
  </AppShell.Body.Content>
</AppShell.Body>
