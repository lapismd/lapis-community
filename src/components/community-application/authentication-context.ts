import { getContext, setContext } from "svelte";

import type { RegistrySigner } from "../../auth/index.js";

export interface CommunityApplicationAuthenticationContext {
  requestAuthentication(action: () => void | Promise<void>): Promise<void>;
  identity(): RegistrySigner | undefined;
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
