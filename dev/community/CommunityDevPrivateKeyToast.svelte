<script lang="ts">
  import { toast } from "svelte-sonner";
  import { onMount, tick } from "svelte";

  import {
    COMMUNITY_DEV_PRIVATE_KEY_TOAST_ID,
    forgetCommunityDevPrivateKey,
    readCommunityDevPrivateKey,
  } from "./private-key-session.js";

  let {
    onForget,
  }: {
    onForget?: () => void | Promise<void>;
  } = $props();

  onMount(() => {
    if (readCommunityDevPrivateKey() === undefined) return;
    const id = COMMUNITY_DEV_PRIVATE_KEY_TOAST_ID;
    void tick().then(() => {
      if (readCommunityDevPrivateKey() === undefined) return;
      toast.warning("Development private key saved in this browser", {
        id,
        description:
          "Forget this key before opening a production Community host.",
        duration: Infinity,
        dismissible: true,
        closeButton: true,
        action: {
          label: "Forget key",
          onClick: () => {
            forgetCommunityDevPrivateKey();
            void onForget?.();
          },
        },
      });
    });
    return () => toast.dismiss(id);
  });
</script>
