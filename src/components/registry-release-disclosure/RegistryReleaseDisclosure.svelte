<script lang="ts">
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";

  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import BanIcon from "@lucide/svelte/icons/ban";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import PackageXIcon from "@lucide/svelte/icons/package-x";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import XIcon from "@lucide/svelte/icons/x";
  import { toast } from "svelte-sonner";
  import { untrack } from "svelte";

  import {
    formatRegistryBytes,
    renderRegistryMarkdown,
    titleCaseRegistryValue,
    type RegistryCatalogDataSource,
    type RegistryReleaseInspection,
    type RegistryReleaseManagementAction,
    type RegistryReleaseManagementCapabilities,
    type RegistryResolvedDetail,
  } from "../../registry/index.js";
  import { registryPluginIcon } from "../registry-plugin-icons.js";
  import { provideRegistryImageLoader } from "../registry-verified-image/context.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { communityChipToneForState } from "../community-chip/model.js";
  import RegistryVerifiedImage from "../registry-verified-image/RegistryVerifiedImage.svelte";
  import RegistryPluginPreview from "./RegistryPluginPreview.svelte";
  import { useCommunityApplicationAuthentication } from "../community-application/authentication-context.js";

  let {
    eventId,
    source,
    onOpenPlugin,
  }: {
    eventId: string;
    source: RegistryCatalogDataSource;
    onOpenPlugin?: (pluginId: string) => void;
  } = $props();

  let open = $state(false);
  let inspection = $state<RegistryReleaseInspection>();
  let resolved = $state<RegistryResolvedDetail>();
  let loading = $state(false);
  let contentError = $state("");
  let acceptedPlugin = $state(false);
  let revision = $state.raw({});
  let inspectionRevision = $state.raw({});
  let capabilities = $state<RegistryReleaseManagementCapabilities>();
  let confirmingAction = $state<RegistryReleaseManagementAction>();
  let performingAction = $state(false);

  const destructiveActions = new Set<RegistryReleaseManagementAction>([
    "reject",
    "revoke",
    "withdraw",
  ]);

  const initialSource = untrack(() => source);
  const applicationAuthentication = useCommunityApplicationAuthentication();
  provideRegistryImageLoader(initialSource.loadImage?.bind(initialSource));

  $effect(() => {
    if (source.loadReleaseInspection === undefined) return;
    inspectionRevision;
    const controller = new AbortController();
    let active = true;
    loading = true;
    void source
      .loadReleaseInspection(eventId, { signal: controller.signal })
      .then((next) => {
        if (active) inspection = next;
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof DOMException) || cause.name !== "AbortError")
        ) {
          inspection = undefined;
        }
      })
      .finally(() => {
        if (active) loading = false;
      });
    return () => {
      active = false;
      controller.abort();
    };
  });

  $effect(() => {
    const current = inspection;
    if (
      !open ||
      current === undefined ||
      source.loadReleaseManagementCapabilities === undefined
    ) {
      capabilities = undefined;
      return;
    }
    revision;
    const controller = new AbortController();
    let active = true;
    void source
      .loadReleaseManagementCapabilities(
        eventId,
        applicationAuthentication?.identity(),
        { signal: controller.signal },
      )
      .then((next) => {
        if (active) capabilities = next;
      })
      .catch(() => {
        if (active) capabilities = undefined;
      });
    return () => {
      active = false;
      controller.abort();
    };
  });

  $effect(() => {
    if (source.subscribe === undefined) return;
    return source.subscribe((event) => {
      revision = {};
      if (event.type === "revision") inspectionRevision = {};
    });
  });

  $effect(() => {
    const current = inspection;
    if (!open || current?.preview === undefined) {
      resolved = undefined;
      acceptedPlugin = false;
      contentError = "";
      return;
    }
    const controller = new AbortController();
    let active = true;
    const loadOverview = current.preview.detail.content?.overview
      ? source
          .loadMarkdown(current.preview.detail.content.overview, {
            signal: controller.signal,
          })
          .then(renderRegistryMarkdown)
      : Promise.resolve(undefined);
    const loadChangelog = current.preview.detail.content?.changelog
      ? source
          .loadMarkdown(current.preview.detail.content.changelog, {
            signal: controller.signal,
          })
          .then(renderRegistryMarkdown)
      : Promise.resolve(undefined);
    void Promise.all([
      loadOverview,
      loadChangelog,
      source.loadIndex({ signal: controller.signal }),
    ])
      .then(([overviewHtml, changelogHtml, index]) => {
        if (!active) return;
        resolved = {
          entry: current.preview!.entry,
          detail: current.preview!.detail,
          ...(overviewHtml === undefined ? {} : { overviewHtml }),
          ...(changelogHtml === undefined ? {} : { changelogHtml }),
        };
        acceptedPlugin =
          current.state === "approved" &&
          index.plugins.some((plugin) => plugin.id === current.pluginId);
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof DOMException) || cause.name !== "AbortError")
        ) {
          resolved = {
            entry: current.preview!.entry,
            detail: current.preview!.detail,
          };
          contentError = "Verified plugin content is unavailable.";
          acceptedPlugin = current.state === "approved";
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  });

  const title = $derived(
    inspection?.preview?.entry.name ?? inspection?.pluginId ?? "Plugin release",
  );
  const summaryEntry = $derived(inspection?.preview?.entry);
  const SummaryIcon = $derived(
    registryPluginIcon(
      summaryEntry?.appearance?.icon ?? summaryEntry?.categories[0],
    ),
  );
  const errorCount = $derived(inspection?.diagnostics.length ?? 0);
  const stateLabel = $derived(
    inspection?.state === undefined
      ? loading
        ? "Inspecting"
        : "Unavailable"
      : inspection.state[0]!.toLocaleUpperCase() + inspection.state.slice(1),
  );

  const actionLabels: Record<RegistryReleaseManagementAction, string> = {
    approve: "Approve release",
    reject: "Reject release",
    revoke: "Revoke release",
    withdraw: "Withdraw release",
    renew: "Renew Registry freshness",
  };

  function actionLabel(action: RegistryReleaseManagementAction): string {
    return action === "renew" && capabilities?.trust === "legacy"
      ? "Establish Registry trust head"
      : actionLabels[action];
  }

  async function performAction(): Promise<void> {
    const action = confirmingAction;
    const signer = applicationAuthentication?.identity();
    if (
      action === undefined ||
      signer === undefined ||
      source.performReleaseAction === undefined
    ) {
      confirmingAction = undefined;
      return;
    }
    performingAction = true;
    try {
      await source.performReleaseAction(
        {
          action,
          eventId,
          ...(inspection?.manifestSha256 === undefined
            ? {}
            : { expectedManifestSha256: inspection.manifestSha256 }),
          ...(capabilities?.headEventId === undefined
            ? {}
            : { expectedHeadEventId: capabilities.headEventId }),
        },
        signer,
      );
      toast.success(`${actionLabel(action)} completed`);
      confirmingAction = undefined;
      revision = {};
      inspectionRevision = {};
    } catch (cause) {
      throw cause instanceof Error
        ? cause
        : new Error(`${actionLabel(action)} failed`);
    } finally {
      performingAction = false;
    }
  }
</script>

{#if inspection !== undefined}
  <Collapsible.Root
    bind:open
    class="registry-release-disclosure"
    data-release-state={inspection.state}
    data-ui-part="registry-release-disclosure"
  >
    <Collapsible.Trigger class="registry-release-disclosure__trigger">
      <span
        class="registry-release-disclosure__identity"
        style:--registry-plugin-accent={summaryEntry?.appearance?.accent ??
          "var(--primary)"}
      >
        {#if summaryEntry?.appearance?.logo}
          <RegistryVerifiedImage
            reference={summaryEntry.appearance.logo}
            alt=""
            loading="lazy"
            fallback={summaryIconFallback}
          />
        {:else}
          <SummaryIcon aria-hidden="true" />
        {/if}
      </span>
      <span class="registry-release-disclosure__summary">
        <span class="registry-release-disclosure__title">{title}</span>
        <span class="registry-release-disclosure__description">
          {summaryEntry?.description ??
            inspection.pluginId ??
            "Signed plugin release"}
        </span>
        <span class="registry-release-disclosure__metadata">
          {#if inspection.version}<span>{inspection.version}</span>{/if}
          {#if summaryEntry?.latestRelease}
            <span
              >{formatRegistryBytes(
                summaryEntry.latestRelease.bundleSize,
              )}</span
            >
          {/if}
          {#if summaryEntry?.platforms.length}
            <span
              >{summaryEntry.platforms
                .map(titleCaseRegistryValue)
                .join(", ")}</span
            >
          {/if}
          {#if errorCount > 0}
            <span
              >{errorCount} validation {errorCount === 1
                ? "issue"
                : "issues"}</span
            >
          {/if}
        </span>
        <span class="registry-release-disclosure__categories">
          <CommunityChip tone={communityChipToneForState(inspection.state)}
            >{stateLabel}</CommunityChip
          >
          {#each summaryEntry?.categories.slice(0, 3) ?? [] as category}
            <CommunityChip>{titleCaseRegistryValue(category)}</CommunityChip>
          {/each}
        </span>
      </span>
      <span class="registry-release-disclosure__status" aria-hidden="true">
        <ChevronRightIcon aria-hidden="true" />
      </span>
    </Collapsible.Trigger>

    <Collapsible.Content class="registry-release-disclosure__content">
      {#if inspection?.diagnostics.length}
        <section
          class="registry-release-disclosure__diagnostics"
          aria-label="Release validation"
        >
          <h4>Validation details</h4>
          <ul>
            {#each inspection.diagnostics as diagnostic}
              <li>
                <code>{diagnostic.path ?? diagnostic.stage}</code>
                <span>{diagnostic.message}</span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if resolved}
        {#if acceptedPlugin && onOpenPlugin}
          <RegistryPluginPreview {resolved} {onOpenPlugin} />
        {:else}
          <RegistryPluginPreview {resolved} />
        {/if}
        {#if contentError}
          <p class="registry-release-disclosure__notice" role="status">
            {contentError}
          </p>
        {/if}
      {:else if inspection?.preview && open}
        <CommunitySkeleton
          layout="details"
          label="Loading verified plugin preview"
        />
      {/if}
      {#if capabilities && capabilities.actions.length > 0}
        <section
          class="registry-release-disclosure__management"
          aria-label="Release management"
        >
          <p>Release management</p>
          <div>
            {#each capabilities.actions as action (action)}
              <Button
                type="button"
                size="sm"
                variant={destructiveActions.has(action)
                  ? "destructive"
                  : "default"}
                disabled={performingAction}
                onclick={() => (confirmingAction = action)}
              >
                {#if action === "approve"}<CheckIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />{:else if action === "reject"}<XIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />{:else if action === "revoke"}<BanIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />{:else if action === "withdraw"}<PackageXIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />{:else}<RefreshCwIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />{/if}
                {actionLabel(action)}
              </Button>
            {/each}
          </div>
        </section>
      {/if}
    </Collapsible.Content>
  </Collapsible.Root>
{/if}

<ConfirmDialog
  open={confirmingAction !== undefined}
  onOpenChange={(next) => {
    if (!next && !performingAction) confirmingAction = undefined;
  }}
  pending={performingAction}
  destructive={confirmingAction !== undefined &&
    destructiveActions.has(confirmingAction)}
  onConfirm={async () => {
    await performAction();
    return confirmingAction === undefined;
  }}
>
  {#snippet title()}
    {confirmingAction === undefined
      ? "Manage release"
      : `${actionLabel(confirmingAction)}?`}
  {/snippet}
  {#snippet description()}
    The release identity, manifest hash, curator role, pinned authority, and
    current Registry head will be checked again before signing.
  {/snippet}
  {#snippet confirmLabel()}{performingAction
      ? "Signing…"
      : "Continue"}{/snippet}
</ConfirmDialog>

{#snippet summaryIconFallback()}
  <SummaryIcon aria-hidden="true" />
{/snippet}

<style>
  :global(.registry-release-disclosure) {
    display: block;
    width: 100%;
    margin-top: 0.55rem;
    margin-bottom: 0.45rem;
    border: 0;
    background: transparent;
  }
  :global(.registry-release-disclosure__trigger) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    width: 100%;
    align-items: start;
    gap: 0.85rem;
    padding: 1rem;
    border: 0;
    border-radius: calc(var(--radius) * 1.2);
    color: var(--foreground);
    background: color-mix(in srgb, var(--secondary) 64%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--foreground) 8%, transparent);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  :global(.registry-release-disclosure__trigger:hover) {
    background: var(--accent);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--foreground) 18%, var(--border));
  }
  :global(
      .community-message:hover .registry-release-disclosure__trigger,
      .community-message:focus-within .registry-release-disclosure__trigger,
      .community-message[data-selected] .registry-release-disclosure__trigger
    ) {
    background: var(--background);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--foreground) 18%, var(--border)),
      var(--shadow-xs);
  }
  :global(.registry-release-disclosure__trigger:focus-visible) {
    outline: 0;
    box-shadow:
      0 0 0 2px var(--background),
      0 0 0 4px var(--ring);
  }
  :global(.registry-release-disclosure[data-state="open"]) {
    overflow: clip;
    border: 1px solid color-mix(in srgb, var(--foreground) 14%, var(--border));
    border-radius: calc(var(--radius) * 1.2);
    background: var(--background);
    box-shadow: var(
      --shadow-lg,
      0 0.75rem 2rem color-mix(in srgb, var(--foreground) 18%, transparent)
    );
  }
  :global(
      .community-message.community-message:has(
          .registry-release-disclosure[data-state="open"]
        )
    ) {
    background: color-mix(in srgb, var(--foreground) 2%, transparent);
  }
  :global(
      .community-message:hover .registry-release-disclosure[data-state="open"],
      .community-message:focus-within
        .registry-release-disclosure[data-state="open"]
    ) {
    border-color: color-mix(in srgb, var(--foreground) 22%, var(--border));
    box-shadow: var(
      --shadow-lg,
      0 0.75rem 2rem color-mix(in srgb, var(--foreground) 18%, transparent)
    );
  }
  :global(
      .registry-release-disclosure[data-state="open"]
        > .registry-release-disclosure__trigger
    ) {
    border-radius: 0;
    background: color-mix(in srgb, var(--secondary) 88%, var(--background));
    box-shadow: none;
  }
  .registry-release-disclosure__identity {
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
  .registry-release-disclosure__identity :global(svg) {
    width: 1.35rem;
    height: 1.35rem;
  }
  .registry-release-disclosure__identity :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .registry-release-disclosure__summary {
    display: grid;
    min-width: 0;
    gap: 0.35rem;
  }
  .registry-release-disclosure__title {
    overflow: hidden;
    font-weight: 700;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .registry-release-disclosure__description {
    display: -webkit-box;
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .registry-release-disclosure__metadata,
  .registry-release-disclosure__categories {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.65rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
  .registry-release-disclosure__metadata {
    min-width: 0;
  }
  .registry-release-disclosure__status {
    display: flex;
    min-width: 0;
    align-self: center;
    align-items: center;
    gap: 0.5rem;
  }
  .registry-release-disclosure__status > :global(svg) {
    width: 1rem;
    height: 1rem;
    flex: none;
    transition: transform 150ms ease;
  }
  :global(.registry-release-disclosure[data-release-state="invalid"]) {
    --registry-plugin-accent: var(--destructive);
  }
  :global(.registry-release-disclosure[data-release-state="untrusted"]),
  :global(.registry-release-disclosure[data-release-state="rejected"]),
  :global(.registry-release-disclosure[data-release-state="revoked"]) {
    background: color-mix(in srgb, var(--muted) 70%, var(--card));
  }
  :global(.registry-release-disclosure__trigger[data-state="open"])
    .registry-release-disclosure__status
    > :global(svg) {
    transform: rotate(90deg);
  }
  :global(.registry-release-disclosure__content) {
    display: grid;
    gap: 0.75rem;
    margin-top: 0;
    padding: 1rem;
    border: 0;
    border-top: 1px solid var(--border);
    border-radius: 0;
    background: var(--background);
  }
  .registry-release-disclosure__diagnostics {
    padding: 0.75rem;
    border-radius: var(--radius);
    background: var(--muted);
  }
  .registry-release-disclosure__diagnostics h4,
  .registry-release-disclosure__diagnostics ul,
  .registry-release-disclosure__notice {
    margin: 0;
  }
  .registry-release-disclosure__diagnostics h4 {
    font-size: var(--community-text-body);
  }
  .registry-release-disclosure__diagnostics ul {
    display: grid;
    gap: 0.45rem;
    margin-top: 0.5rem;
    padding: 0;
    list-style: none;
  }
  .registry-release-disclosure__diagnostics li {
    display: grid;
    gap: 0.15rem;
  }
  .registry-release-disclosure__diagnostics code {
    width: fit-content;
    color: var(--foreground);
    font-size: var(--community-text-secondary);
    font-weight: 600;
  }
  .registry-release-disclosure__diagnostics span,
  .registry-release-disclosure__notice {
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
  }
  .registry-release-disclosure__management {
    display: grid;
    gap: 0.65rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }
  .registry-release-disclosure__management > p {
    margin: 0;
    font-size: var(--community-text-body);
  }
  .registry-release-disclosure__management > div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  @media (max-width: 38rem) {
    :global(.registry-release-disclosure__trigger) {
      gap: 0.65rem;
      padding: 0.8rem;
    }
    .registry-release-disclosure__status {
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }
</style>
