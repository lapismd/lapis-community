<script lang="ts">
  import { onMount, untrack } from "svelte";

  import RegistryCommunityView from "./RegistryCommunityView.svelte";
  import {
    createRegistryCommunityController,
    type RegistryCommunityProps,
  } from "./registry-community-controller.svelte.js";

  let {
    plugin = "",
    name = "Plugin",
    version = "",
    publisher = "",
    relays = "[]",
  }: RegistryCommunityProps = $props();

  const controller = untrack(() =>
    createRegistryCommunityController({
      plugin,
      name,
      version,
      publisher,
      relays,
    }),
  );

  onMount(() => {
    controller.initialize();
    return controller.dispose;
  });
</script>

<RegistryCommunityView {controller} />
