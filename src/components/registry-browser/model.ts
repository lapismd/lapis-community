import type { Snippet } from "svelte";

import type { RegistrySigner } from "../../auth/index.js";
import type { RegistryCommunityDataSource } from "../../community/index.js";
import type {
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
}

export interface RegistryBrowserProps extends RegistryBrowserOptions {
  route?: RegistryRoute;
  onRouteChange?: (route: RegistryRoute) => void;
}
