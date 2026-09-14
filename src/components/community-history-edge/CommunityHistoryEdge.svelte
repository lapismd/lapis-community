<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Spinner } from "@lapismd/design-core/shadcn/spinner";
  import type { CommunityHistoryState } from "../../community/index.js";
  let {
    history,
    onLoad,
    label = "Load earlier",
    viewport = null,
  }: {
    history: CommunityHistoryState;
    onLoad: () => Promise<void>;
    label?: string;
    viewport?: HTMLElement | null;
  } = $props();
  let edge = $state<HTMLDivElement | null>(null);
  let pending = $state(false);
  let error = $state<string>();
  let alive = true,
    version = 0;
  let priorKey: string | undefined;
  onDestroy(() => {
    alive = false;
    version++;
  });
  $effect(() => {
    const key = history.key;
    if (key === priorKey) return;
    priorKey = key;
    version++;
    pending = false;
    error = undefined;
  });
  async function load() {
    if (pending || history.loading || !history.hasOlder) return;
    const request = version;
    pending = true;
    error = undefined;
    try {
      await onLoad();
    } catch (cause) {
      if (alive && version === request)
        error =
          cause instanceof Error
            ? cause.message
            : "History could not be loaded";
    } finally {
      if (alive && version === request) pending = false;
    }
  }
  $effect(() => {
    const node = edge,
      root = viewport,
      key = history.key;
    if (!node || !root) return;
    let armed = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!alive || key !== untrack(() => history.key)) return;
        const near = entries.some((entry) => entry.isIntersecting);
        if (!near) armed = true;
        else if (armed) {
          armed = false;
          void load();
        }
      },
      { root, rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  });
</script>

<div
  bind:this={edge}
  data-ui-component="community-history-edge"
  aria-busy={pending || history.loading}
>
  {#if history.hasOlder || error || history.error}
    <Button
      variant="ghost"
      size="sm"
      disabled={pending || history.loading}
      onclick={load}
    >
      {#if pending || history.loading}<Spinner aria-hidden="true" /> Loading earlier…
      {:else if error || history.error}Retry earlier history{:else}{label}{/if}
    </Button>
  {/if}
  {#if error || history.error}<p role="alert">{error ?? history.error}</p>{/if}
</div>

<style>
  [data-ui-component="community-history-edge"] {
    display: grid;
    justify-items: center;
  }
</style>
