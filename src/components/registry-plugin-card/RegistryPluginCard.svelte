<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import BookmarkIcon from "@lucide/svelte/icons/bookmark";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import PackageIcon from "@lucide/svelte/icons/package";
  import PresentationIcon from "@lucide/svelte/icons/presentation";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import Table2Icon from "@lucide/svelte/icons/table-2";

  import {
    formatRegistryBytes,
    registryStatusLabel,
    titleCaseRegistryValue,
    type RegistryCatalogEntry,
  } from "../../registry/index.js";
  import RegistryVerifiedImage from "../registry-verified-image/RegistryVerifiedImage.svelte";

  let {
    plugin,
    variant = "card",
    onOpen = () => {},
  }: {
    plugin: RegistryCatalogEntry;
    variant?: "card" | "list" | "compact";
    onOpen?: (plugin: RegistryCatalogEntry) => void;
  } = $props();

  const fallbackIcon = $derived(
    plugin.appearance?.icon ?? plugin.categories[0],
  );
  const PluginIcon = $derived(
    fallbackIcon === "sparkles" || fallbackIcon === "ai"
      ? SparklesIcon
      : fallbackIcon === "table-2" || fallbackIcon === "data"
        ? Table2Icon
        : fallbackIcon === "bookmark"
          ? BookmarkIcon
          : fallbackIcon === "network" || fallbackIcon === "graph"
            ? NetworkIcon
            : fallbackIcon === "history"
              ? HistoryIcon
              : fallbackIcon === "search"
                ? SearchIcon
                : fallbackIcon === "presentation"
                  ? PresentationIcon
                  : fallbackIcon === "file-text" || fallbackIcon === "markdown"
                    ? FileTextIcon
                    : PackageIcon,
  );
</script>

{#snippet pluginIcon()}
  <PluginIcon aria-hidden="true" />
{/snippet}

<button
  type="button"
  class="registry-plugin-card"
  data-variant={variant}
  aria-label={`Open ${plugin.name}`}
  onclick={() => onOpen(plugin)}
>
  <span
    class="registry-plugin-card__identity"
    style:--registry-plugin-accent={plugin.appearance?.accent ??
      "var(--primary)"}
  >
    {#if plugin.appearance?.logo}
      <RegistryVerifiedImage
        reference={plugin.appearance.logo}
        alt={plugin.appearance.logo.alt}
        fallback={pluginIcon}
        loading="lazy"
      />
    {:else}
      <PluginIcon aria-hidden="true" />
    {/if}
  </span>
  <span class="registry-plugin-card__content">
    <span class="registry-plugin-card__title">{plugin.name}</span>
    <span class="registry-plugin-card__description">{plugin.description}</span>
    {#if variant !== "compact"}
      <span class="registry-plugin-card__metadata">
        <span>{plugin.latestVersion}</span>
        {#if plugin.latestRelease}
          <span>{formatRegistryBytes(plugin.latestRelease.bundleSize)}</span>
        {/if}
        <span>{plugin.platforms.map(titleCaseRegistryValue).join(", ")}</span>
      </span>
      <span class="registry-plugin-card__categories" aria-label="Plugin tags">
        <Badge
          class="registry-plugin-card__status"
          variant="outline"
          data-status={plugin.status}
          >{registryStatusLabel(plugin.status)}</Badge
        >
        {#each plugin.categories.slice(0, 3) as category}
          <span>{titleCaseRegistryValue(category)}</span>
        {/each}
      </span>
    {/if}
  </span>
</button>

<style>
  .registry-plugin-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    width: 100%;
    gap: 0.85rem;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.35);
    padding: 1rem;
    color: var(--foreground);
    background: color-mix(in srgb, var(--card) 94%, transparent);
    text-align: start;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background 150ms ease,
      transform 150ms ease;
  }

  .registry-plugin-card[data-variant="compact"] {
    border: 0;
    border-radius: var(--radius);
    padding: 0.65rem;
    background: transparent;
  }

  .registry-plugin-card[data-variant="list"] {
    border-color: transparent;
    border-radius: calc(var(--radius) * 1.2);
    background: color-mix(in srgb, var(--secondary) 64%, transparent);
  }

  .registry-plugin-card:hover,
  .registry-plugin-card:focus-visible {
    border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
    background: var(--accent);
    outline: none;
  }

  .registry-plugin-card[data-variant="card"]:hover {
    transform: translateY(-1px);
  }

  .registry-plugin-card__identity {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--registry-plugin-accent) 38%, var(--border));
    border-radius: calc(var(--radius) * 1.1);
    color: var(--registry-plugin-accent);
    background: color-mix(
      in srgb,
      var(--registry-plugin-accent) 14%,
      var(--muted)
    );
  }

  .registry-plugin-card__identity :global(svg) {
    width: 1.35rem;
    height: 1.35rem;
  }

  .registry-plugin-card__identity :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .registry-plugin-card__content {
    display: grid;
    min-width: 0;
    gap: 0.35rem;
  }

  .registry-plugin-card__title {
    font-weight: 700;
    line-height: 1.2;
  }

  .registry-plugin-card__description {
    display: -webkit-box;
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: 0.9rem;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .registry-plugin-card[data-variant="compact"]
    .registry-plugin-card__description {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .registry-plugin-card__metadata,
  .registry-plugin-card__categories {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.65rem;
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  .registry-plugin-card__categories > span {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.15rem 0.45rem;
    color: var(--foreground);
    background: color-mix(in srgb, var(--secondary) 82%, var(--background));
  }

  :global(.registry-plugin-card__status) {
    border-color: color-mix(in srgb, var(--primary) 34%, var(--border));
    border-radius: 999px;
    color: var(--foreground);
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
  }

  :global(.registry-plugin-card__status[data-status="active"]) {
    border-color: color-mix(in srgb, #16a34a 44%, var(--border));
    color: color-mix(in srgb, #16a34a 70%, var(--foreground));
    background: color-mix(in srgb, #16a34a 14%, var(--background));
  }
</style>
