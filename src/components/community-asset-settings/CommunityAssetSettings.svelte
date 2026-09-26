<script lang="ts">
  import { ConfirmButton } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";

  import {
    CommunityAssetRequestError,
    type CommunityAsset,
    type CommunityAssetHistoryItem,
    type CommunityAssetManagement,
    type CommunityAssetReport,
  } from "../../community/asset-management.js";
  import type { CommunitySettingsState } from "../../community/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import "../community-settings/CommunitySettings.css";
  import {
    communityAssetErrorMessage,
    communityAssetIsInUse,
    communityAssetReportHash,
    formatCommunityAssetBytes,
    formatCommunityAssetTime,
  } from "./asset-settings-presentation.js";
  import "./CommunityAssetSettings.css";

  type AssetRow = CommunityAsset & { purpose: "avatar" | "emoji" };
  type ReportState = "idle" | "loading" | "ready" | "forbidden" | "error";

  let {
    model,
    management,
  }: {
    model: CommunitySettingsState;
    management?: CommunityAssetManagement | undefined;
  } = $props();

  let assets = $state<AssetRow[]>([]);
  let history = $state<CommunityAssetHistoryItem[]>([]);
  let reports = $state<CommunityAssetReport[]>([]);
  let loading = $state(true),
    refreshing = $state(false),
    error = $state(""),
    message = $state("");
  let reportState = $state<ReportState>("idle"),
    reportError = $state("");
  let generation = 0;

  $effect(() => {
    management;
    const current = ++generation;
    queueMicrotask(() => void loadAssets(current));
    return () => void (generation += 1);
  });

  async function loadAssets(current = ++generation): Promise<void> {
    if (!management) {
      loading = false;
      error = "Reconnect your identity to load relay media.";
      return;
    }
    const preserveContent = assets.length > 0 || history.length > 0;
    loading = !preserveContent;
    refreshing = preserveContent;
    error = "";
    message = "";
    try {
      const [avatars, emojis, lifecycle] = await Promise.all([
        management.listAssets("avatar"),
        management.listAssets("emoji"),
        management.listHistory(),
      ]);
      if (current !== generation) return;
      assets = [
        ...avatars.items.map((asset) => ({
          ...asset,
          purpose: "avatar" as const,
        })),
        ...emojis.items.map((asset) => ({
          ...asset,
          purpose: "emoji" as const,
        })),
      ];
      history = lifecycle.items;
    } catch (cause) {
      if (current !== generation) return;
      error = communityAssetErrorMessage(
        cause,
        "Relay media could not be loaded.",
      );
    } finally {
      if (current === generation) {
        loading = false;
        refreshing = false;
      }
    }
  }

  async function deleteAsset(asset: AssetRow): Promise<void> {
    if (!management) throw new Error("Relay media is unavailable.");
    error = "";
    message = "";
    try {
      await management.deleteAsset(asset.sha256);
      assets = assets.filter((candidate) => candidate.sha256 !== asset.sha256);
      message = "Asset deleted from the relay.";
      const lifecycle = await management.listHistory();
      history = lifecycle.items;
    } catch (cause) {
      error = communityAssetErrorMessage(cause, "Asset deletion failed.");
      throw cause;
    }
  }

  async function loadReports(): Promise<void> {
    if (!management) return;
    reportState = "loading";
    reportError = "";
    try {
      reports = (await management.listReports()).items;
      reportState = "ready";
    } catch (cause) {
      if (cause instanceof CommunityAssetRequestError && cause.status === 403) {
        reportState = "forbidden";
        return;
      }
      reportError = communityAssetErrorMessage(
        cause,
        "Reports could not be loaded.",
      );
      reportState = "error";
    }
  }
</script>

<header class="community-settings__heading">
  <h1 id="settings-title">Media</h1>
  <p>Review your relay uploads, their lifecycle, and safe deletion status.</p>
</header>

<div class="community-assets">
  <section class="community-assets__section">
    <header>
      <div>
        <h2>Your uploads</h2>
        <p>Avatar and custom emoji images owned by your connected identity.</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading || refreshing || !management}
        aria-busy={refreshing}
        onclick={() => void loadAssets()}
      >
        <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
        Refresh
      </Button>
    </header>
    {#if loading}
      <CommunitySkeleton
        layout="gallery"
        count={2}
        label="Loading relay media"
      />
    {:else if error && assets.length === 0}
      <div class="community-assets__notice" role="alert">
        <p>{error}</p>
        {#if management}<Button
            variant="outline"
            onclick={() => void loadAssets()}>Retry</Button
          >{/if}
      </div>
    {:else if assets.length === 0}
      <p class="community-assets__empty">No avatar or emoji uploads found.</p>
    {:else}
      <ul class="community-assets__grid">
        {#each assets as asset (`${asset.purpose}:${asset.sha256}`)}
          <li>
            <img src={asset.url} alt="" />
            <div class="community-assets__asset-copy">
              <div class="community-assets__chips">
                <CommunityChip size="compact">{asset.purpose}</CommunityChip>
                {#if communityAssetIsInUse(asset, model)}
                  <CommunityChip size="compact" tone="success"
                    >In use</CommunityChip
                  >
                {/if}
              </div>
              <strong>{formatCommunityAssetBytes(asset.size)}</strong>
              <small title={asset.sha256}>{asset.sha256}</small>
              <time datetime={new Date(asset.uploaded * 1_000).toISOString()}
                >{formatCommunityAssetTime(asset.uploaded)}</time
              >
            </div>
            {#if communityAssetIsInUse(asset, model)}
              <p class="community-assets__retained">
                Update your profile or emoji set before deleting this asset.
              </p>
            {:else}
              <ConfirmButton
                title="Delete this relay asset?"
                description="The image bytes will be removed if no other owner or active reference retains them."
                confirmLabel="Delete asset"
                destructive
                size="sm"
                onConfirm={() => deleteAsset(asset)}>Delete</ConfirmButton
              >
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    {#if error && assets.length > 0}<p
        class="community-assets__error"
        role="alert"
      >
        {error}
      </p>{/if}
    {#if message}<p class="community-assets__message" role="status">
        {message}
      </p>{/if}
  </section>

  <section class="community-assets__section">
    <header>
      <div>
        <h2>Lifecycle history</h2>
        <p>Append-only evidence remains after an upload is deleted.</p>
      </div>
    </header>
    {#if loading}
      <CommunitySkeleton
        layout="timeline"
        count={3}
        label="Loading asset history"
      />
    {:else if history.length === 0}
      <p class="community-assets__empty">No lifecycle activity yet.</p>
    {:else}
      <ol class="community-assets__history">
        {#each history as item (item.cursor)}
          <li>
            <span>
              <strong>{item.action.replaceAll("-", " ")}</strong>
              <small title={item.sha256}>{item.sha256}</small>
            </span>
            {#if item.reference_type}<CommunityChip
                size="compact"
                variant="muted">{item.reference_type}</CommunityChip
              >{/if}
            <time datetime={new Date(item.occurred_at * 1_000).toISOString()}
              >{formatCommunityAssetTime(item.occurred_at)}</time
            >
          </li>
        {/each}
      </ol>
    {/if}
  </section>

  <section class="community-assets__section">
    <header>
      <div>
        <h2>Manager report queue</h2>
        <p>Loaded only on request; the relay decides who may review reports.</p>
      </div>
      {#if reportState === "idle"}
        <Button variant="outline" size="sm" onclick={() => void loadReports()}
          >Load reports</Button
        >
      {/if}
    </header>
    {#if reportState === "loading"}
      <CommunitySkeleton
        layout="timeline"
        count={2}
        label="Loading asset reports"
      />
    {:else if reportState === "forbidden"}
      <div class="community-assets__notice">
        <p>Manager access is required to review the report queue.</p>
        <Button variant="outline" size="sm" onclick={() => void loadReports()}
          >Retry manager access</Button
        >
      </div>
    {:else if reportState === "error"}
      <div class="community-assets__notice" role="alert">
        <p>{reportError}</p>
        <Button variant="outline" size="sm" onclick={() => void loadReports()}
          >Retry</Button
        >
      </div>
    {:else if reportState === "ready" && reports.length === 0}
      <p class="community-assets__empty">No asset reports are waiting.</p>
    {:else if reportState === "ready"}
      <ul class="community-assets__reports">
        {#each reports as report (report.event.id)}
          <li>
            <CommunityChip size="compact" tone="warning"
              >{report.status}</CommunityChip
            >
            <span>
              <strong>{report.event.content || "Asset report"}</strong>
              <small title={communityAssetReportHash(report)}
                >{communityAssetReportHash(report)}</small
              >
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
