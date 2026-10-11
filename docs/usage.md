# Using Lapis Community

[Package overview](../README.md) · [Registry](registry.md) · [Development](development.md)

## Installation and public imports

```sh
npm install @lapismd/lapis-community svelte
# or
pnpm add @lapismd/lapis-community svelte
```

Use Svelte 5 or newer for the component exports. The package ships ESM and
TypeScript declarations. Protocol, relay and registry subpaths can be used
without importing the component barrel. Your host supplies relay addresses,
trusted public keys, authentication and application lifetime.

| Import                                                        | Purpose                                                               |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `@lapismd/lapis-community/protocol`                           | Event contracts, templates, verification and deterministic projection |
| `@lapismd/lapis-community/nostr`                              | Relay transports, queries and WebSocket relay factory                 |
| `@lapismd/lapis-community/auth`                               | Explicit signer and relay authentication adapters                     |
| `@lapismd/lapis-community/registry/nip29`                     | Live verified NIP-29 plugin catalog source                            |
| `@lapismd/lapis-community/community`                          | Community controller, event storage and conversation contracts        |
| `@lapismd/lapis-community/projects`                           | NIP-34 project collaboration                                          |
| `@lapismd/lapis-community/components`                         | Composable Svelte Community components                                |
| `@lapismd/lapis-community/components/community-message`       | Focused message component                                             |
| `@lapismd/lapis-community/components/community-chat-composer` | Focused Markdown composer                                             |

The library is separate from the first-party `@lapis-notes/community` plugin.
Install that plugin through your Lapis host when you want the integrated
workspace experience rather than building your own host.

Read the [published specification](https://lapismd.github.io/lapis-community/),
the [public UI catalog](../src/components/ui-catalog.json), and the
[component contracts](../spec/src/components.md) before composing an application.
GitHub Actions builds the spec site from `spec/src` and deploys it on `main`.

## Load a live Nostr catalog

```ts
import { createNip29RegistryCatalogDataSource } from "@lapismd/lapis-community/registry/nip29";
import { createWebSocketCommunityRelayFactory } from "@lapismd/lapis-community/nostr";
import type { Nip29RegistryAuthorities } from "@lapismd/lapis-community/protocol";

export async function loadCatalog(
  relays: readonly string[],
  authorities: Nip29RegistryAuthorities,
) {
  const source = createNip29RegistryCatalogDataSource({
    relays,
    authorities,
    relayFactory: createWebSocketCommunityRelayFactory(),
  });
  try {
    return await source.loadIndex();
  } finally {
    source.dispose();
  }
}
```

Supply actual relay URLs, a `Set` of curator public keys and a `Map` from plugin
IDs to authorized publisher-key sets. Obtain them from your deployment's public
trust configuration; do not substitute fixture keys for production authority.
For a live application, retain the source, subscribe to its changes, and dispose
it only when its owning application lifetime ends.

The host maps deployment configuration into this source; the package does not
read server environment variables. An injected reader signer is optional, and
an ephemeral in-memory signer handles read-only NIP-42 when it is omitted. The
source caches only verified signed events, exact manifest bytes, synchronization
metadata, and resources requested while browsing. Cached catalogs remain
browseable offline, but new installs stay disabled until one configured relay
completes a fresh synchronization.
The host that creates the source also owns calling `source.dispose()` when its
application lifetime ends; mounting and unmounting a registry route does not
dispose a shared source.

For the live source, the relay WebSocket URL determines its HTTP Blossom
endpoint. Manifests, images, Markdown, and install bundle references use that
relay endpoint and the signed content hash; Community never falls back to a
publisher or fixture asset server. `blossomUrl` remains available for relays
that publish Blossom below a non-root path. Every response must match the
signed size and SHA-256 before Community receives a Blob or text value.

## Conversations, Inbox, Agents and channel canvases

New direct conversations use encrypted NIP-17 and support up to eight recipients.
On Buzz relays, the composer also offers explicitly labelled relay-readable messaging;
existing conversations keep their original transport. Inbox groups direct messages,
mentions and participated threads, with shared read state and working filters.

Agents use one editor for their profile, instructions and approved messaging participants.
Enable and Disable remain pending until the controller acknowledges the processing change.
Project home and related channels expose a shared Markdown Canvas in channel settings,
with membership and management permissions, retained drafts and stale-edit review.

See the [messaging actions](../spec/src/nostr-protocol.md#messaging-and-inbox-controller-actions)
and [UI catalog](../src/components/ui-catalog.json) for public controller and component examples.
