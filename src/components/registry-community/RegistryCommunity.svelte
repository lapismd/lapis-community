<script lang="ts">
  import { onMount, untrack } from "svelte";

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

  const controller = untrack(() =>
    createRegistryCommunityController({
      plugin,
      name,
      version,
      publisher,
      relays,
      ...(dataSource === undefined ? {} : { dataSource }),
      ...(identity === undefined ? {} : { identity }),
    }),
  );

  onMount(() => {
    controller.initialize();
    return controller.dispose;
  });
</script>

<RegistryCommunityView {controller} />
