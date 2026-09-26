import BadgeCheckIcon from "@lucide/svelte/icons/badge-check";
import CircleOffIcon from "@lucide/svelte/icons/circle-off";
import ClockIcon from "@lucide/svelte/icons/clock";
import ShieldXIcon from "@lucide/svelte/icons/shield-x";
import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
import type { Component } from "svelte";

import type { RegistryCatalogStatus } from "../../registry/model.js";

interface RegistryReleaseStatusOption {
  value: RegistryCatalogStatus;
  label: string;
  icon: Component;
  accent: string;
}

export const registryReleaseStatusOptions: RegistryReleaseStatusOption[] = [
  { value: "pending", label: "Pending", icon: ClockIcon, accent: "#b45309" },
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
