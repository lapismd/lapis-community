import type { CommunityController, CommunityIdentity } from "./contracts.js";

const identityReaders = new WeakMap<
  CommunityController,
  () => CommunityIdentity | undefined
>();

export function registerCommunityControllerIdentityReader(
  controller: CommunityController,
  read: () => CommunityIdentity | undefined,
): void {
  identityReaders.set(controller, read);
}

export function readCommunityControllerIdentity(
  controller: CommunityController,
): CommunityIdentity | undefined {
  return identityReaders.get(controller)?.();
}
