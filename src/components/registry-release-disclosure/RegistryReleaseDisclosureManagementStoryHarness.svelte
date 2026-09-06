<script lang="ts">
  import type { RegistrySigner } from "../../auth/index.js";
  import type { RegistryCatalogDataSource } from "../../registry/index.js";
  import { provideCommunityApplicationAuthentication } from "../community-application/authentication-context.js";
  import RegistryReleaseDisclosure from "./RegistryReleaseDisclosure.svelte";

  let {
    eventId,
    source,
    signer,
  }: {
    eventId: string;
    source: RegistryCatalogDataSource;
    signer: RegistrySigner;
  } = $props();

  provideCommunityApplicationAuthentication({
    identity: () => signer,
    requestAuthentication: async (action) => void (await action()),
  });
</script>

<RegistryReleaseDisclosure {eventId} {source} />
