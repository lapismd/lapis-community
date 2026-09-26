import type {
  CommunityAsset,
  CommunityAssetReport,
} from "../../community/asset-management.js";
import type { CommunitySettingsState } from "../../community/index.js";

export function communityAssetIsInUse(
  asset: CommunityAsset,
  model: CommunitySettingsState,
): boolean {
  return (
    asset.url === model.profile.picture ||
    model.customEmojis.some((emoji) => emoji.owned && emoji.url === asset.url)
  );
}

export function communityAssetErrorMessage(
  cause: unknown,
  fallback: string,
): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function communityAssetReportHash(report: CommunityAssetReport): string {
  return report.event.tags.find((tag) => tag[0] === "x")?.[1] ?? "Unknown";
}

export function formatCommunityAssetBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export function formatCommunityAssetTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value * 1_000));
}
