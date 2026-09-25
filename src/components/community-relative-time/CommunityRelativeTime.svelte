<script lang="ts">
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import { onMount, type Snippet } from "svelte";

  import {
    formatCommunityFullDate,
    formatCommunityRelativeTime,
  } from "./model.js";

  let {
    timestamp,
    now,
    absoluteAfterDays,
    href,
    ariaLabel,
    class: className = "",
    suffix,
  }: {
    timestamp: number;
    now?: number;
    absoluteAfterDays?: number;
    href?: string;
    ariaLabel?: string;
    class?: string;
    suffix?: Snippet;
  } = $props();

  let liveTime = $state(Math.floor(Date.now() / 1_000));
  const currentTime = $derived(now ?? liveTime);
  const fullDate = $derived(formatCommunityFullDate(timestamp));
  const relativeDate = $derived(
    formatCommunityRelativeTime(
      timestamp,
      absoluteAfterDays === undefined
        ? { now: currentTime }
        : { now: currentTime, absoluteAfterDays },
    ),
  );
  const dateTime = $derived(new Date(timestamp * 1_000).toISOString());

  onMount(() => {
    if (now !== undefined) return;
    const interval = window.setInterval(() => {
      liveTime = Math.floor(Date.now() / 1_000);
    }, 30_000);
    return () => window.clearInterval(interval);
  });
</script>

<Tooltip.Provider delayDuration={0}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        {#if href}
          <a
            {...props}
            {href}
            class={["community-relative-time", className]
              .filter(Boolean)
              .join(" ")}
            aria-label={ariaLabel}
            title={fullDate}
          >
            <time datetime={dateTime}>{relativeDate}</time>
            {@render suffix?.()}
          </a>
        {:else}
          <time
            {...props}
            datetime={dateTime}
            class={["community-relative-time", className]
              .filter(Boolean)
              .join(" ")}
            aria-label={ariaLabel}
            title={fullDate}>{relativeDate}</time
          >
        {/if}
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top" sideOffset={6}>{fullDate}</Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>

<style>
  .community-relative-time {
    display: inline-flex;
    width: fit-content;
    max-width: 100%;
    align-items: baseline;
    justify-self: start;
    vertical-align: baseline;
  }
</style>
