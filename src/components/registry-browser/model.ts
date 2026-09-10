import type { Snippet } from "svelte";

import type { RegistrySigner } from "../../auth/index.js";
import type { RegistryCommunityDataSource } from "../../community/index.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";
import type {
  RegistryCatalogEntry,
  RegistryCatalogDataSource,
  RegistryInstallAction,
  RegistryInstallRequest,
  RegistryRoute,
} from "../../registry/index.js";

export interface RegistryBrowserOptions {
  source: RegistryCatalogDataSource;
  discussionDataSource?: RegistryCommunityDataSource;
  discussionIdentity?: RegistrySigner;
  discussion?: Snippet;
  installActions?: Readonly<Record<string, RegistryInstallAction>>;
  onInstall?: (request: RegistryInstallRequest) => void | Promise<void>;
  onOpenMemberProfile?: (member: CommunityMemberModel) => void;
  onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
}

export interface RegistryBrowserProps extends RegistryBrowserOptions {
  route?: RegistryRoute;
  showBreadcrumb?: boolean;
  onRouteChange?: (route: RegistryRoute) => void;
  onActiveEntryChange?: (entry: RegistryCatalogEntry | undefined) => void;
}
