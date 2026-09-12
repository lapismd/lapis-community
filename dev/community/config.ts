export const DEFAULT_COMMUNITY_DEV_RELAY_URL = "ws://registry.localhost:8281";

type CommunityDevEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveCommunityDevRelayConfiguration(
  environment: CommunityDevEnvironment,
): { relayUrl: string; registryRelays: string[]; authUrl?: string } {
  const relayUrl =
    environment.VITE_COMMUNITY_LIVE_RELAY_URL?.trim() ||
    DEFAULT_COMMUNITY_DEV_RELAY_URL;

  const authUrl = environment.VITE_COMMUNITY_RELAY_AUTH_URL?.trim();
  return {
    relayUrl,
    registryRelays: [relayUrl],
    ...(authUrl ? { authUrl: new URL(authUrl).origin } : {}),
  };
}
