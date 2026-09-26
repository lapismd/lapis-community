import BadgeCheckIcon from "@lucide/svelte/icons/badge-check";
import CircleOffIcon from "@lucide/svelte/icons/circle-off";
import ShieldXIcon from "@lucide/svelte/icons/shield-x";
import SparklesIcon from "@lucide/svelte/icons/sparkles";
import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

export const registryReleaseStatusOptions = [
  { value: "pending", label: "Pending", icon: SparklesIcon, accent: "#b45309" },
  { value: "active", label: "Active", icon: BadgeCheckIcon, accent: "#15803d" },
  {
    value: "deprecated",
    label: "Deprecated",
    icon: TriangleAlertIcon,
    accent: "#a16207",
  },
  { value: "disabled", label: "Disabled", icon: CircleOffIcon, accent: "#64748b" },
  {
    value: "revoked",
    label: "Revoked",
    icon: ShieldXIcon,
    accent: "var(--destructive, #dc2626)",
  },
];
