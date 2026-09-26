<script lang="ts">
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
  import MonitorIcon from "@lucide/svelte/icons/monitor";

  import {
    formatRegistryBytes,
    registryStatusLabel,
    titleCaseRegistryValue,
    type RegistryMediaItem,
    type RegistryResolvedDetail,
  } from "../../registry/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { registryFilterIcon } from "../registry-filter-icons.js";
  import RegistryPluginChangelog from "./RegistryPluginChangelog.svelte";
  import RegistryMediaGallery from "../registry-media-gallery/RegistryMediaGallery.svelte";
  import RegistryMediaViewer from "../registry-media-viewer/RegistryMediaViewer.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { registryPluginIcon } from "../registry-plugin-icons.js";
  import RegistryVerifiedImage from "../registry-verified-image/RegistryVerifiedImage.svelte";

  let {
    resolved,
    onOpenPlugin,
  }: {
    resolved: RegistryResolvedDetail;
    onOpenPlugin?: (pluginId: string) => void;
  } = $props();

  let activeTab = $state("overview");
  let detailViewerOpen = $state(false);
  let detailViewerItems = $state<readonly RegistryMediaItem[]>([]);
  let detailViewerInitialMode = $state<"preview" | "full" | "light" | "dark">(
    "full",
  );
  let detailViewerOpener = $state<HTMLElement | null>(null);
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
  const author = $derived(detail.author || detail.owner.name);
  const authorUrl = $derived(
    detail.authorUrl ?? entry.authorUrl ?? detail.owner.url,
  );
  const authorAvatarUrl = $derived(
    detail.authorAvatarUrl ?? entry.authorAvatarUrl,
  );
  const authorMember = $derived({
    id: authorUrl ?? author,
    name: author,
    handle: author,
    initials: initials(author),
    ...(authorAvatarUrl === undefined ? {} : { avatarUrl: authorAvatarUrl }),
  });
  const PluginIcon = $derived(
    registryPluginIcon(detail.appearance?.icon ?? entry.categories[0]),
  );
  const dateFormatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  function initials(value: string): string {
    return value
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase();
  }

  function showMedia(
    item: RegistryMediaItem,
    initialMode: "preview" | "full" | "light" | "dark",
    target: HTMLElement,
  ): void {
    detailViewerItems = [item];
    detailViewerInitialMode = initialMode;
    detailViewerOpener = target;
    detailViewerOpen = true;
  }
</script>

{#snippet filterChip(value: string)}
  {@const FilterIcon = registryFilterIcon(value)}
  <CommunityChip>
    <FilterIcon data-icon="inline-start" aria-hidden="true" />
    <span>{titleCaseRegistryValue(value)}</span>
  </CommunityChip>
{/snippet}

<article class="registry-plugin-preview" aria-label={`${detail.name} preview`}>
  <header
    class="registry-plugin-preview__hero"
    class:with-banner={Boolean(detail.media?.banner)}
  >
    <div class="registry-plugin-preview__hero-copy">
      <div class="registry-plugin-preview__identity-row">
        <span
          class="registry-plugin-preview__icon"
          style:--registry-plugin-accent={detail.appearance?.accent ??
            "var(--primary)"}
        >
          {#if detail.appearance?.logo}
            <RegistryVerifiedImage
              reference={detail.appearance.logo}
              alt=""
              width={detail.appearance.logo.width}
              height={detail.appearance.logo.height}
              loading="lazy"
              fallback={pluginIconFallback}
            />
          {:else}
            <PluginIcon aria-hidden="true" />
          {/if}
        </span>
        <div class="registry-plugin-preview__identity">
          <h3>
            {#if onOpenPlugin}
              <a
                href={`#registry/plugins/${encodeURIComponent(detail.id)}`}
                onclick={(event) => {
                  event.preventDefault();
                  onOpenPlugin?.(detail.id);
                }}>{detail.name}</a
              >
            {:else}
              {detail.name}
            {/if}
          </h3>
          {#if authorUrl}
            <a
              class="registry-plugin-preview__author-link"
              href={authorUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <CommunityMemberAvatar
                member={authorMember}
                size="xsmall"
                decorative
              />
              <span>By {author}</span>
            </a>
          {:else}
            <span
              class="registry-plugin-preview__author-link disabled"
              aria-label={`By ${author}`}
            >
              <CommunityMemberAvatar
                member={authorMember}
                size="xsmall"
                decorative
              />
              <span>By {author}</span>
            </span>
          {/if}
          <div class="registry-plugin-preview__badges">
            <CommunityChip variant="muted">{detail.latestVersion}</CommunityChip
            >
            {#each entry.platforms as platform}
              {@render filterChip(platform)}
            {/each}
          </div>
        </div>
      </div>
      <p class="registry-plugin-preview__description">{detail.description}</p>
    </div>

    {#if detail.media?.banner}
      <button
        type="button"
        class="registry-plugin-preview__banner"
        aria-label={`Open ${detail.name} banner: ${detail.media.banner.alt}`}
        onclick={(event) =>
          showMedia(detail.media!.banner!, "dark", event.currentTarget)}
      >
        <RegistryVerifiedImage
          reference={detail.media.banner.images.dark}
          alt=""
          width={detail.media.banner.images.dark.width}
          height={detail.media.banner.images.dark.height}
          loading="lazy"
        />
      </button>
    {/if}
  </header>

  {#if detail.gallery?.length}
    <RegistryMediaGallery items={detail.gallery} pluginName={detail.name} />
  {/if}

  <section class="registry-plugin-preview__content" aria-label="Plugin content">
    <Tabs.Root bind:value={activeTab}>
      <Tabs.List aria-label="Plugin preview sections">
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="changelog">Changelog</Tabs.Trigger>
        <Tabs.Trigger value="releases"
          >Releases <CommunityChip
            class="registry-plugin-preview__tab-count"
            variant="muted"
            tone="accent"
            size="compact">{releases.length}</CommunityChip
          ></Tabs.Trigger
        >
        <Tabs.Trigger value="details">Details</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview">
        <div class="registry-plugin-preview__prose">
          {#if detail.media?.overview}
            <button
              type="button"
              class="registry-plugin-preview__overview-media"
              aria-label={`Open ${detail.name} overview image: ${detail.media.overview.alt}`}
              onclick={(event) =>
                showMedia(
                  detail.media!.overview!,
                  "preview",
                  event.currentTarget,
                )}
            >
              <RegistryVerifiedImage
                reference={detail.media.overview.images.preview}
                alt=""
                width={detail.media.overview.images.preview.width}
                height={detail.media.overview.images.preview.height}
                loading="lazy"
              />
            </button>
          {/if}
          {#if detail.highlights?.length}
            <section>
              <h3>Highlights</h3>
              <ul>
                {#each detail.highlights as highlight}
                  <li>{highlight}</li>
                {/each}
              </ul>
            </section>
          {/if}
          <p>{detail.description}</p>
        </div>
      </Tabs.Content>
      <Tabs.Content value="changelog">
        <RegistryPluginChangelog
          latestVersion={detail.latestVersion}
          {releases}
        />
      </Tabs.Content>
      <Tabs.Content value="releases">
        <div class="registry-plugin-preview__releases">
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
              <CommunityChip
                class="registry-plugin-preview__bundle-chip"
                variant={item.bundle.pending ? "outline" : "muted"}
                tone={item.bundle.pending ? "warning" : "success"}
                >{item.bundle.pending
                  ? "Pending bundle"
                  : "Signed bundle"}</CommunityChip
              >
            </article>
          {/each}
        </div>
      </Tabs.Content>
      <Tabs.Content value="details">
        <div class="registry-plugin-preview__details">
          <section>
            <h3>About</h3>
            <p>{detail.description}</p>
            {#if entry.categories.length > 0}
              <div
                class="registry-plugin-preview__badges"
                aria-label="Categories"
              >
                {#each entry.categories as category}
                  {@render filterChip(category)}
                {/each}
              </div>
            {/if}
          </section>
          <dl class="registry-plugin-preview__facts">
            <div>
              <dt><CalendarIcon aria-hidden="true" /> Released</dt>
              <dd>
                {release
                  ? dateFormatter.format(new Date(release.releasedAt))
                  : "Unknown"}
              </dd>
            </div>
            <div>
              <dt><MonitorIcon aria-hidden="true" /> Minimum app</dt>
              <dd>{release?.minAppVersion ?? "Unknown"}</dd>
            </div>
            <div>
              <dt><HardDriveIcon aria-hidden="true" /> Bundle</dt>
              <dd>
                {release ? formatRegistryBytes(release.bundle.size) : "Unknown"}
              </dd>
            </div>
          </dl>
          <dl class="registry-plugin-preview__detail-list">
            <div>
              <dt>Current version</dt>
              <dd>{detail.latestVersion}</dd>
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
          </dl>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  </section>

  <RegistryMediaViewer
    items={detailViewerItems}
    pluginName={detail.name}
    opener={detailViewerOpener}
    initialMode={detailViewerInitialMode}
    bind:open={detailViewerOpen}
  />
</article>

{#snippet pluginIconFallback()}
  <PluginIcon aria-hidden="true" />
{/snippet}

<style>
  .registry-plugin-preview {
    display: grid;
    gap: 1.1rem;
    width: min(100%, 56rem);
    margin-inline: auto;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .registry-plugin-preview__hero {
    display: grid;
    align-items: center;
    gap: 1.25rem;
  }
  .registry-plugin-preview__hero.with-banner {
    grid-template-columns: minmax(0, 30rem) minmax(12rem, 24rem);
    justify-content: center;
  }
  .registry-plugin-preview__hero-copy {
    display: grid;
    min-width: 0;
    gap: 0.9rem;
  }
  .registry-plugin-preview__identity-row {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 1rem;
  }
  .registry-plugin-preview__icon {
    display: grid;
    width: 4rem;
    height: 4rem;
    flex: none;
    place-items: center;
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--registry-plugin-accent) 38%, var(--border));
    border-radius: calc(var(--radius) * 1.5);
    color: var(--registry-plugin-accent);
    background: color-mix(
      in srgb,
      var(--registry-plugin-accent) 14%,
      var(--muted)
    );
  }
  .registry-plugin-preview__icon :global(svg) {
    width: 1.8rem;
    height: 1.8rem;
  }
  .registry-plugin-preview__icon :global(img) {
    width: 76%;
    height: 76%;
    object-fit: contain;
  }
  .registry-plugin-preview__identity {
    min-width: 0;
  }
  .registry-plugin-preview h3,
  .registry-plugin-preview p,
  .registry-plugin-preview dl,
  .registry-plugin-preview dd {
    margin: 0;
  }
  .registry-plugin-preview__identity h3 {
    font-size: var(--community-text-dialog);
    font-weight: 650;
    line-height: 1.2;
  }
  .registry-plugin-preview__identity h3 a {
    color: inherit;
    text-decoration: none;
  }
  .registry-plugin-preview__identity h3 a:hover {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }
  .registry-plugin-preview__identity h3 a:focus-visible {
    border-radius: 0.15rem;
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .registry-plugin-preview__description,
  .registry-plugin-preview__facts dt {
    color: var(--muted-foreground);
  }
  .registry-plugin-preview__author-link {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.3rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    text-decoration: none;
  }
  a.registry-plugin-preview__author-link:hover {
    color: var(--foreground);
    text-decoration: underline;
    text-underline-offset: 0.16em;
  }
  a.registry-plugin-preview__author-link:focus-visible {
    border-radius: 0.2rem;
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .registry-plugin-preview__description {
    max-width: 48rem;
    font-size: var(--community-text-body);
    line-height: 1.5;
  }
  .registry-plugin-preview__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.45rem;
  }
  .registry-plugin-preview__banner,
  .registry-plugin-preview__overview-media {
    display: block;
    width: 100%;
    overflow: hidden;
    border: 0;
    border-radius: 0.65rem;
    padding: 0;
    background: #09090b;
    cursor: zoom-in;
  }
  .registry-plugin-preview__banner {
    max-width: 24rem;
    justify-self: start;
  }
  .registry-plugin-preview__overview-media {
    max-width: 32rem;
    margin-inline: auto;
  }
  .registry-plugin-preview__banner :global(img),
  .registry-plugin-preview__overview-media :global(img) {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: cover;
  }
  .registry-plugin-preview__banner:focus-visible,
  .registry-plugin-preview__overview-media:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .registry-plugin-preview__facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .registry-plugin-preview__facts div {
    min-width: 0;
    padding: 0.65rem;
    border-radius: var(--radius);
    background: var(--muted);
  }
  .registry-plugin-preview__facts dt {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: var(--community-text-secondary);
  }
  .registry-plugin-preview__facts dt :global(svg) {
    width: 0.85rem;
    height: 0.85rem;
  }
  .registry-plugin-preview__facts dd {
    margin-top: 0.25rem;
    overflow-wrap: anywhere;
    font-size: var(--community-text-body);
    font-weight: 600;
  }
  .registry-plugin-preview__content {
    min-width: 0;
  }
  .registry-plugin-preview__content :global([data-ui-part="tabs"]) {
    display: grid;
  }
  .registry-plugin-preview__content :global([data-ui-part="tabs-content"]) {
    min-width: 0;
  }
  .registry-plugin-preview__content :global([data-ui-part="tabs-list"]) {
    max-width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
  }
  :global(.registry-plugin-preview__tab-count[data-ui-part="community-chip"]) {
    min-width: 1.25rem;
    margin-inline-start: 0.25rem;
    font-variant-numeric: tabular-nums;
  }
  .registry-plugin-preview__prose {
    display: grid;
    min-width: 0;
    gap: 1rem;
    padding-block: 1rem 0.25rem;
    color: var(--foreground);
    font-size: var(--community-text-body);
    line-height: 1.65;
  }
  .registry-plugin-preview__prose :global(:first-child) {
    margin-top: 0;
  }
  .registry-plugin-preview__prose :global(:last-child) {
    margin-bottom: 0;
  }
  .registry-plugin-preview__prose :global(h1) {
    margin-block: 1.25rem 0.65rem;
    font-size: var(--community-text-dialog);
    line-height: 1.25;
  }
  .registry-plugin-preview__prose :global(h2) {
    margin-block: 1.1rem 0.55rem;
    font-size: var(--community-text-section);
    line-height: 1.3;
  }
  .registry-plugin-preview__prose :global(h3) {
    margin-block: 1rem 0.5rem;
    font-size: var(--community-text-body);
  }
  .registry-plugin-preview__prose :global(p),
  .registry-plugin-preview__prose :global(ul),
  .registry-plugin-preview__prose :global(ol) {
    margin-block: 0.65rem;
  }
  .registry-plugin-preview__releases {
    display: grid;
    padding-block: 0.5rem;
  }
  .registry-plugin-preview__releases article {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 0.85rem;
    border-bottom: 1px solid var(--border);
  }
  .registry-plugin-preview__releases h3,
  .registry-plugin-preview__releases p,
  .registry-plugin-preview__details h3,
  .registry-plugin-preview__details p {
    margin: 0;
  }
  .registry-plugin-preview__releases h3,
  .registry-plugin-preview__details h3 {
    font-size: var(--community-text-body);
  }
  .registry-plugin-preview__releases p,
  .registry-plugin-preview__details p {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    line-height: 1.5;
  }
  .registry-plugin-preview__details {
    display: grid;
    gap: 1rem;
    padding-block: 1rem 0.25rem;
  }
  .registry-plugin-preview__details > section {
    display: grid;
    gap: 0.5rem;
  }
  .registry-plugin-preview__detail-list {
    display: grid;
    gap: 0;
    border-top: 1px solid var(--border);
  }
  .registry-plugin-preview__detail-list > div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    padding-block: 0.55rem;
    border-bottom: 1px solid var(--border);
  }
  .registry-plugin-preview__detail-list dt {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
  .registry-plugin-preview__detail-list dd {
    text-align: right;
    font-size: var(--community-text-secondary);
    font-weight: 600;
  }
  @media (max-width: 36rem) {
    .registry-plugin-preview__hero.with-banner {
      grid-template-columns: 1fr;
    }
    .registry-plugin-preview__banner {
      width: min(100%, 20rem);
      justify-self: start;
    }
    .registry-plugin-preview__facts {
      grid-template-columns: 1fr;
    }
  }
</style>
