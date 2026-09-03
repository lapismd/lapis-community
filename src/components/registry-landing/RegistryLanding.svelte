<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import PackageIcon from "@lucide/svelte/icons/package";

  import {
    registryLandingSections,
    type RegistryCatalogEntry,
  } from "../../registry/index.js";
  import RegistryPluginCard from "../registry-plugin-card/RegistryPluginCard.svelte";

  let {
    plugins,
    onOpenDirectory = () => {},
    onOpenPlugin = () => {},
    onOpenCategory = () => {},
  }: {
    plugins: readonly RegistryCatalogEntry[];
    onOpenDirectory?: () => void;
    onOpenPlugin?: (plugin: RegistryCatalogEntry) => void;
    onOpenCategory?: (category: string) => void;
  } = $props();

  const sections = $derived(registryLandingSections(plugins));
</script>

<div class="registry-landing">
  <header class="registry-landing__hero">
    <span class="registry-landing__eyebrow"
      ><PackageIcon aria-hidden="true" /> Plugin registry</span
    >
    <h1>Make Lapis Notes yours.</h1>
    <p>
      Browse {plugins.length} plugins built for Lapis Notes by the community.
    </p>
  </header>

  <section
    class="registry-landing__section"
    aria-labelledby="registry-landing-plugins"
  >
    <button
      class="registry-landing__section-link"
      type="button"
      onclick={onOpenDirectory}
    >
      <h2 id="registry-landing-plugins">Plugins</h2>
      <ChevronRightIcon aria-hidden="true" />
    </button>
    <div class="registry-landing__lanes">
      <section>
        <button
          type="button"
          class="registry-landing__lane-link"
          onclick={onOpenDirectory}
        >
          Featured <ChevronRightIcon aria-hidden="true" />
        </button>
        <div class="registry-landing__list">
          {#each sections.featured.slice(0, 5) as plugin (plugin.id)}
            <RegistryPluginCard
              {plugin}
              variant="compact"
              onOpen={onOpenPlugin}
            />
          {/each}
        </div>
      </section>
      <section>
        <button
          type="button"
          class="registry-landing__lane-link"
          onclick={onOpenDirectory}
        >
          New <ChevronRightIcon aria-hidden="true" />
        </button>
        <div class="registry-landing__list">
          {#each sections.newlyReleased as plugin (plugin.id)}
            <RegistryPluginCard
              {plugin}
              variant="compact"
              onOpen={onOpenPlugin}
            />
          {/each}
        </div>
      </section>
      <section>
        <button
          type="button"
          class="registry-landing__lane-link"
          onclick={onOpenDirectory}
        >
          Updated <ChevronRightIcon aria-hidden="true" />
        </button>
        <div class="registry-landing__list">
          {#each sections.recentlyUpdated as plugin (plugin.id)}
            <RegistryPluginCard
              {plugin}
              variant="compact"
              onOpen={onOpenPlugin}
            />
          {/each}
        </div>
      </section>
    </div>
  </section>

  <section
    class="registry-landing__section"
    aria-labelledby="registry-landing-categories"
  >
    <button
      class="registry-landing__section-link"
      type="button"
      onclick={onOpenDirectory}
    >
      <h2 id="registry-landing-categories">Categories</h2>
      <ChevronRightIcon aria-hidden="true" />
    </button>
    <div class="registry-landing__categories">
      {#each sections.categories as category (category.id)}
        <button
          type="button"
          aria-label={`${category.label}, ${category.count} plugin${category.count === 1 ? "" : "s"}`}
          onclick={() => onOpenCategory(category.id)}
        >
          <PackageIcon aria-hidden="true" />
          <strong>{category.label}</strong>
          <span>{category.count}</span>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .registry-landing {
    display: grid;
    gap: clamp(2.5rem, 7vw, 5rem);
    width: min(100%, 76rem);
    margin-inline: auto;
    padding: clamp(2rem, 6vw, 5rem) clamp(1rem, 4vw, 3rem);
  }

  .registry-landing__hero {
    display: grid;
    justify-items: center;
    gap: 0.85rem;
    padding-block: clamp(2rem, 8vw, 5rem);
    text-align: center;
  }

  .registry-landing__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--primary);
    font-size: 0.82rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .registry-landing__eyebrow :global(svg) {
    width: 1rem;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    max-width: 15ch;
    font-size: clamp(2.5rem, 7vw, 5.25rem);
    line-height: 0.96;
    letter-spacing: -0.05em;
  }

  .registry-landing__hero p {
    color: var(--muted-foreground);
    font-size: clamp(1rem, 2vw, 1.15rem);
  }

  .registry-landing__section {
    display: grid;
    gap: 1.25rem;
  }

  .registry-landing__section-link,
  .registry-landing__lane-link {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 0.25rem;
    border: 0;
    padding: 0;
    color: inherit;
    background: none;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .registry-landing__section-link :global(svg) {
    width: 1.4rem;
  }

  .registry-landing__lane-link {
    margin-bottom: 0.25rem;
  }

  .registry-landing__lane-link :global(svg) {
    width: 1rem;
  }

  .registry-landing__section-link:hover,
  .registry-landing__lane-link:hover {
    color: var(--primary);
  }

  .registry-landing__lanes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(1.5rem, 4vw, 3rem);
  }

  .registry-landing__list {
    display: grid;
  }

  .registry-landing__categories {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .registry-landing__categories button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    color: var(--foreground);
    background: var(--card);
    text-align: start;
    cursor: pointer;
  }

  .registry-landing__categories button:hover,
  .registry-landing__categories button:focus-visible {
    border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
    background: var(--accent);
    outline: none;
  }

  .registry-landing__categories button > span {
    color: var(--muted-foreground);
  }

  @media (max-width: 54rem) {
    .registry-landing__lanes {
      grid-template-columns: 1fr;
    }

    .registry-landing__categories {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 32rem) {
    .registry-landing__categories {
      grid-template-columns: 1fr;
    }
  }
</style>
