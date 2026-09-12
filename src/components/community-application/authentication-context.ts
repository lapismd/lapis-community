import { getContext, setContext } from "svelte";

import type { RegistrySigner } from "../../auth/index.js";
import type { CommunityAccountSession } from "../../auth/index.js";
import type { CommunityApplicationAuthenticationStatus } from "./model.js";
import type {
  CommunityAccountManagementActions,
  CommunityAccountResumeAction,
} from "../community-account-settings/model.js";
import type { CommunityRelayAuthConfig } from "../../auth/index.js";

export interface CommunityApplicationAuthenticationContext {
  requestAuthentication(action: () => void | Promise<void>): Promise<void>;
  identity(): RegistrySigner | undefined;
  account?(): CommunityAccountSession | undefined;
  config?(): CommunityRelayAuthConfig | undefined;
  accountActions?(): CommunityAccountManagementActions | undefined;
  resumeAccountAction?(): CommunityAccountResumeAction | undefined;
  status?(): CommunityApplicationAuthenticationStatus;
  activeExternalSigner?(): "keytr" | undefined;
  connectGitHub?(): Promise<void>;
  signOut?(): Promise<void>;
}

const authenticationContextKey = Symbol("community-application-authentication");

export function provideCommunityApplicationAuthentication(
  context: CommunityApplicationAuthenticationContext,
): void {
  setContext(authenticationContextKey, context);
}

export function useCommunityApplicationAuthentication():
  | CommunityApplicationAuthenticationContext
  | undefined {
  return getContext(authenticationContextKey);
}
