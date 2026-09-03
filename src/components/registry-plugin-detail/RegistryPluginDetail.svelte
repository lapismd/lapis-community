<script lang="ts">
  import type { Snippet } from "svelte";

  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import BugIcon from "@lucide/svelte/icons/bug";
  import CheckCircleIcon from "@lucide/svelte/icons/circle-check";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import PackageIcon from "@lucide/svelte/icons/package";

  import {
    formatRegistryBytes,
    registryStatusLabel,
    titleCaseRegistryValue,
    type RegistryCatalogEntry,
    type RegistryInstallAction,
    type RegistryInstallRequest,
    type RegistryResolvedDetail,
  } from "../../registry/index.js";
  import { registryFilterIcon } from "../registry-filter-icons.js";
  import RegistryMediaGallery from "../registry-media-gallery/RegistryMediaGallery.svelte";
  import RegistryPluginCard from "../registry-plugin-card/RegistryPluginCard.svelte";

  let {
    resolved,
    related = [],
    installAction,
    discussion,
    onInstall,
    onOpenPlugin = () => {},
    onOpenCategory = () => {},
    onOpenPlatform = () => {},
  }: {
    resolved: RegistryResolvedDetail;
    related?: readonly RegistryCatalogEntry[];
    installAction?: RegistryInstallAction;
    discussion?: Snippet;
    onInstall?: (request: RegistryInstallRequest) => void | Promise<void>;
    onOpenPlugin?: (plugin: RegistryCatalogEntry) => void;
    onOpenCategory?: (category: string) => void;
    onOpenPlatform?: (platform: string) => void;
  } = $props();

  let activeTab = $state("overview");
  let submitting = $state(false);
  let installError = $state("");
  const entry = $derived(resolved.entry);
  const detail = $derived(resolved.detail);
  const release = $derived(detail.versions[detail.latestVersion]);
  const releases = $derived(
    Object.values(detail.versions).toSorted(
      (left, right) =>
        right.releasedAt.localeCompare(left.releasedAt) ||
        right.version.localeCompare(left.version),
    ),
  );
  const filePatterns = $derived(
    detail.contributes?.editorViews?.flatMap((view) => view.filenamePatterns) ??
      [],
  );
  const effectiveInstallAction = $derived.by<RegistryInstallAction>(() => {
    if (installAction) return installAction;
    if (onInstall === undefined)
      return {
        state: "disabled",
        reason: "Installation is not available in this host",
      };
    if (detail.status !== "active")
      return {
        state: "disabled",
        reason: `${detail.name} is ${registryStatusLabel(detail.status).toLocaleLowerCase()}`,
      };
    if (release === undefined || release.bundle.pending === true)
      return {
        state: "disabled",
        reason: "The verified plugin bundle is not ready",
      };
    return { state: "available" };
  });
  const installDisabled = $derived(
    submitting ||
      effectiveInstallAction.state === "installing" ||
      effectiveInstallAction.state === "installed" ||
      effectiveInstallAction.state === "disabled",
  );
  const installLabel = $derived(
    effectiveInstallAction.label ??
      (submitting || effectiveInstallAction.state === "installing"
        ? "Installing…"
        : effectiveInstallAction.state === "installed"
          ? "Installed"
          : effectiveInstallAction.state === "disabled"
            ? "Install unavailable"
            : effectiveInstallAction.state === "rejected"
              ? "Retry install"
              : "Install in Lapis"),
  );
  const author = $derived(detail.author || detail.owner.name);
  const authorUrl = $derived(
    detail.authorUrl ?? entry.authorUrl ?? detail.owner.url,
  );
  const authorAvatarUrl = $derived(
    detail.authorAvatarUrl ?? entry.authorAvatarUrl,
  );
  const bundleHealth = $derived(release?.bundle.pending === true ? 1 : 4);

  const dateFormatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  function formatDate(value: string | undefined): string {
    return value ? dateFormatter.format(new Date(value)) : "Unknown";
  }

  function openExternal(url: string): void {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function initials(value: string): string {
    return value
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase();
  }

  async function install(): Promise<void> {
    if (installDisabled || onInstall === undefined || release === undefined)
      return;
    submitting = true;
    installError = "";
    try {
      await onInstall({
        pluginId: detail.id,
        version: release.version,
        bundle: release.bundle,
      });
    } catch (cause) {
      installError =
        cause instanceof Error
          ? cause.message
          : "The plugin could not be installed";
    } finally {
      submitting = false;
    }
  }
</script>

{#snippet authorAvatar()}
  <span class="registry-plugin-detail__author-avatar" aria-hidden="true">
    {#if authorAvatarUrl}
      <img src={authorAvatarUrl} alt="" />
    {:else}
      {initials(author)}
    {/if}
  </span>
{/snippet}

{#snippet authorLink(compact = false)}
  {#if authorUrl}
    <a
      class="registry-plugin-detail__author-link"
      class:compact
      href={authorUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {@render authorAvatar()}
      <span class="registry-plugin-detail__author-name"
        >{compact ? author : `By ${author}`}</span
      >
    </a>
  {:else}
    <span class="registry-plugin-detail__author-link disabled" class:compact>
      {@render authorAvatar()}
      <span class="registry-plugin-detail__author-name"
        >{compact ? author : `By ${author}`}</span
      >
    </span>
  {/if}
{/snippet}

{#snippet filterChip(type: "category" | "platform", value: string)}
  {@const FilterIcon = registryFilterIcon(value)}
  <button
    type="button"
    class="registry-plugin-detail__filter-chip"
    onclick={() =>
      type === "category" ? onOpenCategory(value) : onOpenPlatform(value)}
  >
    <FilterIcon aria-hidden="true" />
    <span>{titleCaseRegistryValue(value)}</span>
  </button>
{/snippet}

<article class="registry-plugin-detail">
  <header
    class="registry-plugin-detail__hero"
    class:with-banner={Boolean(detail.media?.banner)}
  >
    <div class="registry-plugin-detail__hero-copy">
      <div class="registry-plugin-detail__identity">
        <span
          class="registry-plugin-detail__icon"
          style:--registry-plugin-accent={detail.appearance?.accent ??
            "var(--primary)"}
        >
          {#if detail.appearance?.logo}
            <img
              src={detail.appearance.logo.url}
              alt={detail.appearance.logo.alt}
            />
          {:else}
            <PackageIcon aria-hidden="true" />
          {/if}
        </span>
        <div>
          <h1>{detail.name}</h1>
          <div class="registry-plugin-detail__hero-meta">
            {@render authorLink()}
            {#each entry.platforms as platform}
              {@render filterChip("platform", platform)}
            {/each}
          </div>
        </div>
      </div>
      <p class="registry-plugin-detail__description">{detail.description}</p>
      <div class="registry-plugin-detail__actions">
        <Button
          type="button"
          disabled={installDisabled}
          aria-busy={submitting ||
            effectiveInstallAction.state === "installing"}
          title={effectiveInstallAction.state === "disabled"
            ? effectiveInstallAction.reason
            : undefined}
          onclick={() => void install()}
        >
          {#if effectiveInstallAction.state === "installed"}<CheckCircleIcon
              data-icon="inline-start"
              aria-hidden="true"
            />{:else}<DownloadIcon
              data-icon="inline-start"
              aria-hidden="true"
            />{/if}
          {installLabel}
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="secondary"
                aria-label="More actions"
              >
                <EllipsisIcon aria-hidden="true" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start">
            {#if detail.links?.documentation}
              <DropdownMenu.Item
                onSelect={() => openExternal(detail.links!.documentation!)}
                ><BookOpenIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />Documentation</DropdownMenu.Item
              >
            {/if}
            {#if detail.links?.repository}
              <DropdownMenu.Item
                onSelect={() => openExternal(detail.links!.repository!)}
                ><ExternalLinkIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />Repository</DropdownMenu.Item
              >
            {/if}
            {#if detail.links?.issues}
              <DropdownMenu.Item
                onSelect={() => openExternal(detail.links!.issues!)}
                ><BugIcon data-icon="inline-start" aria-hidden="true" />Report
                bug</DropdownMenu.Item
              >
            {/if}
            {#if release && release.bundle.pending !== true}
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                onSelect={() =>
                  openExternal(
                    release.bundle.downloadUrl ?? release.bundle.url,
                  )}
                ><DownloadIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />Download .lapis-plugin</DropdownMenu.Item
              >
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
      {#if installError}<p class="registry-plugin-detail__error" role="alert">
          {installError}
        </p>{/if}
      {#if effectiveInstallAction.state === "rejected"}
        <p class="registry-plugin-detail__error" role="status">
          {effectiveInstallAction.reason}
        </p>
      {/if}
    </div>
    {#if detail.media?.banner}
      <img
        class="registry-plugin-detail__banner"
        src={detail.media.banner.images.dark.url}
        alt={detail.media.banner.alt}
        width={detail.media.banner.images.dark.width}
        height={detail.media.banner.images.dark.height}
      />
    {/if}
  </header>

  {#if detail.gallery?.length}
    <RegistryMediaGallery items={detail.gallery} pluginName={detail.name} />
  {/if}

  {#if resolved.contentError}
    <p class="registry-plugin-detail__content-warning" role="status">
      {resolved.contentError} The verified catalog metadata is still available.
    </p>
  {/if}

  <div class="registry-plugin-detail__layout">
    <section class="registry-plugin-detail__content">
      <Tabs.Root bind:value={activeTab}>
        <Tabs.List aria-label="Plugin sections">
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="changelog">Changelog</Tabs.Trigger>
          <Tabs.Trigger value="releases"
            >Releases <span>{releases.length}</span></Tabs.Trigger
          >
        </Tabs.List>
        <Tabs.Content value="overview">
          <div class="registry-plugin-detail__prose">
            {#if detail.media?.overview}
              <img
                src={detail.media.overview.images.preview.url}
                alt={detail.media.overview.alt}
                width={detail.media.overview.images.preview.width}
                height={detail.media.overview.images.preview.height}
              />
            {/if}
            {#if detail.highlights?.length}
              <section>
                <h2>Highlights</h2>
                <ul>
                  {#each detail.highlights as highlight}<li>
                      {highlight}
                    </li>{/each}
                </ul>
              </section>
            {/if}
            {#if resolved.overviewHtml}
              <section class="registry-plugin-detail__markdown">
                {@html resolved.overviewHtml}
              </section>
            {:else}
              <p>{detail.description}</p>
            {/if}
            {#if filePatterns.length > 0}
              <section>
                <h2>File handlers</h2>
                <div class="registry-plugin-detail__file-patterns">
                  {#each filePatterns as pattern}<code>{pattern}</code>{/each}
                </div>
              </section>
            {/if}
          </div>
        </Tabs.Content>
        <Tabs.Content value="changelog">
          <div class="registry-plugin-detail__prose">
            {#if resolved.changelogHtml}
              <section class="registry-plugin-detail__markdown">
                {@html resolved.changelogHtml}
              </section>
            {:else}<p>
                No structured changelog is available for this plugin yet.
              </p>{/if}
          </div>
        </Tabs.Content>
        <Tabs.Content value="releases">
          <div class="registry-plugin-detail__releases">
            {#each releases as item (item.version)}
              <article>
                <div>
                  <h3>{item.version}</h3>
                  <p>
                    Lapis {item.minAppVersion}+ · {item.platforms
                      .map(titleCaseRegistryValue)
                      .join(", ")} · {formatRegistryBytes(item.bundle.size)}
                  </p>
                </div>
                <Badge variant={item.bundle.pending ? "outline" : "secondary"}
                  >{item.bundle.pending
                    ? "Pending bundle"
                    : "Signed bundle"}</Badge
                >
              </article>
            {/each}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </section>

    <aside class="registry-plugin-detail__sidebar">
      <section
        class="registry-plugin-detail__health"
        aria-label="Plugin health"
      >
        <div>
          <span><strong>Metadata</strong><strong>Signed</strong></span><progress
            aria-label="Metadata health"
            max="4"
            value="4"
          ></progress>
        </div>
        <div>
          <span
            ><strong>Plugin bundle</strong><strong
              >{bundleHealth === 4 ? "Ready" : "Pending"}</strong
            ></span
          ><progress
            aria-label="Plugin bundle health"
            max="4"
            value={bundleHealth}
          ></progress>
        </div>
      </section>
      <section>
        <h2>About</h2>
        <p>{detail.description}</p>
        <div class="registry-plugin-detail__chips">
          {#each entry.categories as category}
            {@render filterChip("category", category)}
          {/each}
        </div>
      </section>
      <section>
        <h2>Details</h2>
        <dl>
          <div>
            <dt>Current version</dt>
            <dd>{detail.latestVersion}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatDate(release?.releasedAt)}</dd>
          </div>
          <div>
            <dt>Releases</dt>
            <dd>{releases.length}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{registryStatusLabel(detail.status)}</dd>
          </div>
          <div>
            <dt>Compatible with</dt>
            <dd>Lapis {release?.minAppVersion ?? entry.minAppVersion}+</dd>
          </div>
          <div>
            <dt>Platforms</dt>
            <dd>{entry.platforms.map(titleCaseRegistryValue).join(", ")}</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>{detail.license ?? "Not specified"}</dd>
          </div>
          <div>
            <dt>Trust</dt>
            <dd>{detail.owner.verified ? "Verified" : "Community"}</dd>
          </div>
          <div>
            <dt>Bundle size</dt>
            <dd>
              {release ? formatRegistryBytes(release.bundle.size) : "Unknown"}
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>Author</h2>
        <div class="registry-plugin-detail__author">
          {@render authorLink(true)}
        </div>
      </section>
    </aside>
  </div>

  {#if related.length > 0}
    <section class="registry-plugin-detail__related">
      <h2>Related plugins</h2>
      <div>
        {#each related as plugin (plugin.id)}<RegistryPluginCard
            {plugin}
            variant="compact"
            onOpen={onOpenPlugin}
          />{/each}
      </div>
    </section>
  {/if}

  {#if discussion}
    <section
      class="registry-plugin-detail__discussion"
      aria-label={`${detail.name} community`}
    >
      {@render discussion()}
    </section>
  {/if}
</article>

<style>
  .registry-plugin-detail {
    display: grid;
    gap: clamp(1.5rem, 4vw, 3rem);
    width: min(100%, 78rem);
    margin-inline: auto;
    padding: clamp(1.25rem, 4vw, 3rem);
  }
  .registry-plugin-detail__hero {
    display: grid;
    gap: 2rem;
    align-items: center;
    min-height: 20rem;
  }
  .registry-plugin-detail__hero.with-banner {
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 1fr);
  }
  .registry-plugin-detail__hero-copy {
    display: grid;
    gap: 1.25rem;
  }
  .registry-plugin-detail__identity {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .registry-plugin-detail__identity h1 {
    margin: 0;
    font-size: clamp(2.25rem, 6vw, 4rem);
    letter-spacing: -0.05em;
  }
  .registry-plugin-detail__icon {
    display: grid;
    width: 5rem;
    height: 5rem;
    place-items: center;
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--registry-plugin-accent) 38%, var(--border));
    border-radius: calc(var(--radius) * 2);
    color: var(--registry-plugin-accent);
    background: color-mix(
      in srgb,
      var(--registry-plugin-accent) 14%,
      var(--muted)
    );
  }
  .registry-plugin-detail__icon :global(svg) {
    width: 2.25rem;
    height: 2.25rem;
  }
  .registry-plugin-detail__icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .registry-plugin-detail__hero-meta,
  .registry-plugin-detail__actions,
  .registry-plugin-detail__chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .registry-plugin-detail__hero-meta {
    margin-top: 0.35rem;
    color: var(--muted-foreground);
  }
  .registry-plugin-detail__author-link,
  .registry-plugin-detail__filter-chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border);
    color: var(--foreground);
    text-decoration: none;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      color 140ms ease,
      box-shadow 140ms ease;
  }
  .registry-plugin-detail__author-link {
    gap: 0.35rem;
    border-color: transparent;
    border-radius: 999px;
    padding: 0.125rem 0.35rem 0.125rem 0.125rem;
    color: var(--muted-foreground);
  }
  .registry-plugin-detail__author-link.compact {
    gap: 0.55rem;
    padding: 0.25rem 0.5rem 0.25rem 0.25rem;
    color: var(--foreground);
    font-weight: 600;
  }
  .registry-plugin-detail__author-link:not(.disabled):hover,
  .registry-plugin-detail__author-link:not(.disabled):focus-visible {
    color: var(--muted-foreground);
    background: transparent;
  }
  .registry-plugin-detail__author-link:not(.disabled):hover
    .registry-plugin-detail__author-name,
  .registry-plugin-detail__author-link:not(.disabled):focus-visible
    .registry-plugin-detail__author-name {
    color: var(--foreground);
  }
  .registry-plugin-detail__author-link:not(.disabled):focus-visible,
  .registry-plugin-detail__filter-chip:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .registry-plugin-detail__author-avatar {
    display: grid;
    width: 1.35rem;
    height: 1.35rem;
    flex: none;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, var(--muted));
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1;
  }
  .registry-plugin-detail__author-link.compact
    .registry-plugin-detail__author-avatar {
    width: 2rem;
    height: 2rem;
    font-size: 0.72rem;
  }
  .registry-plugin-detail__author-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .registry-plugin-detail__filter-chip {
    gap: 0.3rem;
    min-height: 1.5rem;
    border-radius: 999px;
    padding: 0.125rem 0.5rem;
    background: var(--background);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .registry-plugin-detail__filter-chip:hover,
  .registry-plugin-detail__filter-chip:focus-visible {
    border-color: color-mix(in srgb, var(--primary) 32%, var(--border));
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 9%, var(--muted));
  }
  .registry-plugin-detail__filter-chip :global(svg) {
    width: 0.9rem;
    height: 0.9rem;
  }
  .registry-plugin-detail__description {
    max-width: 48rem;
    margin: 0;
    font-size: clamp(1.1rem, 2vw, 1.4rem);
    line-height: 1.5;
  }
  .registry-plugin-detail__error {
    margin: 0;
    color: var(--destructive);
  }

  .registry-plugin-detail__content-warning {
    margin: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    color: var(--muted-foreground);
    background: var(--muted);
  }
  .registry-plugin-detail__banner {
    width: 100%;
    max-height: 22rem;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.5);
    object-fit: cover;
  }
  .registry-plugin-detail__layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 18rem;
    gap: clamp(1.5rem, 4vw, 3rem);
    align-items: start;
  }
  .registry-plugin-detail__content {
    min-width: 0;
  }
  .registry-plugin-detail__content :global([data-ui-part="tabs"]) {
    display: grid;
  }
  .registry-plugin-detail__content :global([data-ui-part="tabs-content"]) {
    min-width: 0;
  }
  .registry-plugin-detail__prose {
    display: grid;
    gap: 1.25rem;
    padding-block: 1.25rem;
    line-height: 1.65;
  }
  .registry-plugin-detail__prose > img {
    width: 100%;
    border-radius: var(--radius);
  }
  .registry-plugin-detail__prose h2,
  .registry-plugin-detail__related h2,
  .registry-plugin-detail__sidebar h2 {
    margin: 0 0 0.65rem;
    font-size: 1rem;
  }
  .registry-plugin-detail__markdown :global(:first-child) {
    margin-top: 0;
  }
  .registry-plugin-detail__file-patterns {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .registry-plugin-detail__file-patterns code {
    border-radius: var(--radius);
    padding: 0.25rem 0.45rem;
    background: var(--muted);
  }
  .registry-plugin-detail__releases {
    display: grid;
    padding-block: 1rem;
  }
  .registry-plugin-detail__releases article {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--border);
    padding: 1rem 0;
  }
  .registry-plugin-detail__releases h3,
  .registry-plugin-detail__releases p {
    margin: 0;
  }
  .registry-plugin-detail__releases p {
    color: var(--muted-foreground);
    font-size: 0.85rem;
  }
  .registry-plugin-detail__sidebar {
    display: grid;
    gap: 1.25rem;
  }
  .registry-plugin-detail__sidebar > section {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
  .registry-plugin-detail__sidebar p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.9rem;
    line-height: 1.45;
  }
  .registry-plugin-detail__health {
    display: grid;
    gap: 0.85rem;
  }
  .registry-plugin-detail__health div {
    display: grid;
    gap: 0.35rem;
  }
  .registry-plugin-detail__health span {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.8rem;
  }
  .registry-plugin-detail__health progress {
    width: 100%;
    height: 0.35rem;
    accent-color: var(--primary);
  }
  dl {
    display: grid;
    gap: 0.55rem;
    margin: 0;
  }
  dl div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem;
    font-size: 0.82rem;
  }
  dt {
    color: var(--muted-foreground);
  }
  dd {
    margin: 0;
    text-align: end;
  }
  .registry-plugin-detail__author {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .registry-plugin-detail__discussion {
    min-width: 0;
  }
  .registry-plugin-detail__related {
    display: grid;
    gap: 0.75rem;
  }
  .registry-plugin-detail__related > div {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.5rem;
  }
  @media (max-width: 58rem) {
    .registry-plugin-detail__hero.with-banner,
    .registry-plugin-detail__layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .registry-plugin-detail__sidebar {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 38rem) {
    .registry-plugin-detail__identity {
      align-items: start;
    }
    .registry-plugin-detail__icon {
      width: 4rem;
      height: 4rem;
    }
    .registry-plugin-detail__sidebar,
    .registry-plugin-detail__related > div {
      grid-template-columns: 1fr;
    }
  }
</style>
