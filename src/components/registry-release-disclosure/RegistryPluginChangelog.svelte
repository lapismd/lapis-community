<script lang="ts">
  import type { RegistryRelease } from "../../registry/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";

  let {
    changelogHtml,
    latestVersion,
    release,
  }: {
    changelogHtml: string | undefined;
    latestVersion: string;
    release: RegistryRelease | undefined;
  } = $props();

  const dateFormatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const versionLabel = $derived(
    latestVersion.startsWith("v") ? latestVersion : `v${latestVersion}`,
  );
  const releasedAt = $derived(
    release
      ? dateFormatter.format(new Date(release.releasedAt))
      : "Unknown date",
  );
</script>

<article
  class="registry-plugin-changelog"
  aria-label={`${latestVersion} changelog`}
>
  <header class="registry-plugin-changelog__header">
    <div class="registry-plugin-changelog__chips">
      <CommunityChip
        class="registry-plugin-changelog__version"
        variant="muted"
        tone="success">{versionLabel}</CommunityChip
      >
      <CommunityChip
        class="registry-plugin-changelog__latest"
        variant="outline"
        tone="success">Latest</CommunityChip
      >
    </div>
    {#if release}
      <time datetime={release.releasedAt}>{releasedAt}</time>
    {:else}
      <span>{releasedAt}</span>
    {/if}
  </header>

  <div class="registry-plugin-changelog__prose">
    {#if changelogHtml}
      {@html changelogHtml}
    {:else}
      <h1>No structured changelog yet</h1>
      <p>This release does not include verified changelog notes.</p>
    {/if}
  </div>
</article>

<style>
  .registry-plugin-changelog {
    display: grid;
    min-width: 0;
    gap: 1.4rem;
    padding: clamp(1.4rem, 4vw, 2.4rem);
    border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
    border-radius: calc(var(--radius) * 1.8);
    background: var(--background);
    box-shadow: 0 1.25rem 3rem
      color-mix(in srgb, var(--foreground) 7%, transparent);
  }

  .registry-plugin-changelog__header {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .registry-plugin-changelog__chips {
    display: flex;
    min-width: 0;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.7rem;
  }

  .registry-plugin-changelog__header time,
  .registry-plugin-changelog__header > span {
    color: color-mix(in srgb, var(--muted-foreground) 84%, var(--foreground));
    font-size: var(--community-text-section);
    font-weight: 500;
    white-space: nowrap;
  }

  .registry-plugin-changelog__prose {
    display: grid;
    gap: 1rem;
    color: color-mix(in srgb, var(--muted-foreground) 84%, var(--foreground));
    font-size: var(--community-text-body);
    line-height: 1.55;
  }

  .registry-plugin-changelog__prose :global(*) {
    margin: 0;
  }

  .registry-plugin-changelog__prose :global(h1) {
    color: var(--foreground);
    font-size: var(--community-text-page);
    font-weight: 800;
    line-height: 1.12;
  }

  .registry-plugin-changelog__prose :global(h2),
  .registry-plugin-changelog__prose :global(h3) {
    margin-top: 0.75rem;
    color: var(--foreground);
    font-size: var(--community-text-section);
    font-weight: 760;
    line-height: 1.2;
  }

  .registry-plugin-changelog__prose :global(ul),
  .registry-plugin-changelog__prose :global(ol) {
    display: grid;
    gap: 0.45rem;
    padding-inline-start: 1.65rem;
  }

  .registry-plugin-changelog__prose :global(li::marker) {
    color: color-mix(in srgb, var(--muted-foreground) 76%, transparent);
  }

  .registry-plugin-changelog__prose :global(code) {
    border-radius: calc(var(--radius) * 0.6);
    background: color-mix(in srgb, var(--muted) 76%, transparent);
    color: color-mix(in srgb, var(--foreground) 72%, var(--muted-foreground));
    padding: 0.08em 0.28em;
  }

  @media (max-width: 34rem) {
    .registry-plugin-changelog__header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
