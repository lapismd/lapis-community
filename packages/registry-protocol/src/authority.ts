import type { RegistryAuthorities } from "./types.js";

export function isPublisherAllowed(
  authorities: RegistryAuthorities,
  pluginId: string,
  pubkey: string,
): boolean {
  const allowlist = authorities.publisherPubkeysByPlugin;
  if (allowlist === undefined) {
    return true;
  }

  return allowlist.get(pluginId)?.has(pubkey) ?? false;
}

export function isRegistryOperator(
  authorities: RegistryAuthorities,
  pubkey: string,
): boolean {
  return (
    authorities.registryOperatorPubkeys.has(pubkey) ||
    authorities.curatorPubkeys.has(pubkey)
  );
}
