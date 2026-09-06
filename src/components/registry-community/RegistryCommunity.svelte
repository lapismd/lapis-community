<script lang="ts">
  import { onMount, untrack } from "svelte";

  import { useCommunityApplicationAuthentication } from "../community-application/authentication-context.js";
  import RegistryCommunityView from "./RegistryCommunityView.svelte";
  import {
    createRegistryCommunityController,
    type RegistryCommunityControllerOptions,
  } from "./registry-community-controller.svelte.js";

  let {
    plugin = "",
    name = "Plugin",
    version = "",
    publisher = "",
    relays = "[]",
    dataSource,
    identity,
  }: RegistryCommunityControllerOptions = $props();

  const applicationAuthentication = useCommunityApplicationAuthentication();

  const controller = untrack(() =>
    createRegistryCommunityController(
      {
        plugin,
        name,
        version,
        publisher,
        relays,
        ...(dataSource === undefined ? {} : { dataSource }),
        ...(identity === undefined ? {} : { identity }),
      },
      applicationAuthentication,
    ),
  );

  $effect(() => {
    const nextIdentity = identity ?? applicationAuthentication?.identity();
    untrack(() => void controller.setIdentity(nextIdentity));
  });

  onMount(() => {
    controller.initialize();
    return controller.dispose;
  });
</script>

<RegistryCommunityView {controller} />
