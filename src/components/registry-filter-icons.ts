import BadgeCheckIcon from "@lucide/svelte/icons/badge-check";
import BlocksIcon from "@lucide/svelte/icons/blocks";
import CircleOffIcon from "@lucide/svelte/icons/circle-off";
import DatabaseIcon from "@lucide/svelte/icons/database";
import FileTextIcon from "@lucide/svelte/icons/file-text";
import GlobeIcon from "@lucide/svelte/icons/globe";
import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
import MonitorIcon from "@lucide/svelte/icons/monitor";
import NetworkIcon from "@lucide/svelte/icons/network";
import NotebookTabsIcon from "@lucide/svelte/icons/notebook-tabs";
import PackageIcon from "@lucide/svelte/icons/package";
import PencilIcon from "@lucide/svelte/icons/pencil";
import PresentationIcon from "@lucide/svelte/icons/presentation";
import SearchIcon from "@lucide/svelte/icons/search";
import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
import SparklesIcon from "@lucide/svelte/icons/sparkles";
import SquareDashedMousePointerIcon from "@lucide/svelte/icons/square-dashed-mouse-pointer";
import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
import WrenchIcon from "@lucide/svelte/icons/wrench";
import ZapIcon from "@lucide/svelte/icons/zap";
import type { Component } from "svelte";

export const registryFilterIcons: Record<string, Component> = {
  active: BadgeCheckIcon,
  all: SlidersHorizontalIcon,
  automation: ZapIcon,
  backup: PackageIcon,
  canvas: SquareDashedMousePointerIcon,
  data: DatabaseIcon,
  database: DatabaseIcon,
  deprecated: TriangleAlertIcon,
  desktop: MonitorIcon,
  "developer-tools": WrenchIcon,
  diagnostics: SlidersHorizontalIcon,
  disabled: CircleOffIcon,
  documents: FileTextIcon,
  editor: PencilIcon,
  export: FileTextIcon,
  graph: NetworkIcon,
  history: PackageIcon,
  knowledge: NetworkIcon,
  markdown: FileTextIcon,
  mobile: PackageIcon,
  navigation: NotebookTabsIcon,
  notebook: NotebookTabsIcon,
  official: ShieldCheckIcon,
  organization: LayoutDashboardIcon,
  package: PackageIcon,
  pending: SparklesIcon,
  presentation: PresentationIcon,
  productivity: ZapIcon,
  revoked: ShieldCheckIcon,
  search: SearchIcon,
  themes: BlocksIcon,
  verified: BadgeCheckIcon,
  viewer: FileTextIcon,
  visualization: NetworkIcon,
  web: GlobeIcon,
};

export function registryFilterIcon(value: string): Component {
  return registryFilterIcons[value.toLocaleLowerCase()] ?? PackageIcon;
}
