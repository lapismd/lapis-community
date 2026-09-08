# Lapis Community

`@lapismd/lapis-community` is the single shared package for the Nostr-first
Lapis community and plugin registry. It is the complete path from signed Nostr
events to the verified projection and discussion components rendered by
`community.lapis.md`.

## Active components

- `src/protocol` defines standard NIP-29 release messages, curator reactions,
  forum posts, replies, and deterministic projection rules.
- `src/nostr` reads those events and content-addressed manifests from configured
  relays.
- `src/auth` provides NIP-07 and headless signers plus the NIP-42 adapter used
  by the browser UI and materializer.
- `src/components` contains composable Svelte components and colocated
  Storybook stories for ratings, discussions, replies, reactions, and bounded
  thread history.
- `src/materializer` verifies publishers, curators, signatures, manifests,
  artifacts, and media before writing the publishable projection.
- `src/registry` exposes compatible HTTP and live NIP-29 catalog sources. The
  live source restores verified raw inputs locally, synchronizes and subscribes
  to relays, then builds the disposable catalog projection in browser memory.
- `src/fixture` creates deterministic local events from the sibling
  `lapis-plugins` checkout for end-to-end testing only.

There is no registry database or submission API. Signed Nostr events and their
content-addressed attachments are the only registry input.

## Materialize

```sh
REGISTRY_RELAYS=wss://relay.example \
REGISTRY_PUBLIC_RELAYS=wss://relay.example \
REGISTRY_PUBLISHER_PUBKEYS=<hex-pubkey> \
REGISTRY_CURATOR_PUBKEYS=<hex-pubkey> \
REGISTRY_READER_SECRET_FILE=/run/secrets/registry-reader \
BLOSSOM_URL=https://relay.example/ \
pnpm registry:materialize --output artifacts/registry
```

The reader file contains a single lowercase hex Nostr secret. It is only an
authenticated read identity for relays that require NIP-42; it is not a
publisher or curator key and must be supplied as a runtime secret.

`BLOSSOM_URL` identifies the configured relay's HTTP Blossom endpoint. The
materializer loads manifests, images, Markdown, and bundles from that endpoint
by their signed SHA-256 rather than contacting an attachment's publisher URL.
Every fetched resource must still match its signed size and SHA-256 before it
is mirrored, so browsers only receive verified `/registry/` assets.

The output contains the index, plugin details, accepted signed events,
provenance root, browser runtime configuration, mirrored resources, and the
community component. The renderer consumes this directory through
`LAPIS_REGISTRY_SOURCE_DIR` and publishes it under `/registry/`.

## Render Community directly from Nostr

```ts
const source = createNip29RegistryCatalogDataSource({
  relays,
  authorities: { curatorPubkeys, publisherPubkeysByPlugin },
  relayFactory: createWebSocketCommunityRelayFactory(),
});
```

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

## Verify locally

```sh
pnpm install --frozen-lockfile
pnpm checks
pnpm local:validate
pnpm smoke:local
```

For live application debugging without Storybook, start the local relay stack
and the dedicated Vite surface:

```sh
pnpm local:up
pnpm dev:community
```

The app opens at `http://127.0.0.1:7036`, connects to
`ws://registry.localhost:8281`, discovers public rooms, and uses Vite HMR. Its
Registry and Projects views read the live signed catalog, discussions, and
NIP-34 project graph from that stack. `local:up` keeps WalGit and RustFS private
behind the relay, seeds one hosted repository plus a project task anchor, and
does not give the browser a sidecar credential or require a local Git checkout.
The Vite config loads only the public curator and publisher keys from
`.local/registry-fixture/fixture.env`; explicit `VITE_REGISTRY_*` values take
precedence.
Guest profile menu exposes browser-extension, NIP-46 remote-signer, ephemeral
account, and private-key login flows. The Remote signer login collects its
bunker URL within the host-provided login flow and keeps it only in browser
memory. Override the relay with `VITE_COMMUNITY_LIVE_RELAY_URL`.

Run `pnpm storybook` to browse the production community components in isolated
normal, reply, reaction, error, and long-discussion states. The package
specification is under `spec/src` and is enforced by
`@lapismd/spec-validator`.

Storybook is supervised per checkout and port. Use `pnpm storybook:restart` to
stop this checkout's listener and start a clean server, or
`pnpm storybook:stop` to stop it. Set `STORYBOOK_PORT` to use another lane; the
scripts refuse to stop a listener owned by a different checkout. Optional
checkout-local settings can be placed in `.env.storybook.local`.

Storybook uses an isolated in-memory relay by default. Its relay toolbar also
offers the public `wss://community.lapis.md` registry relay without seeding or
publishing fixture events. Override the live target or canonical room IDs when
running against another registry relay:

```sh
VITE_COMMUNITY_LIVE_RELAY_URL=ws://registry.localhost:8281 \
VITE_COMMUNITY_LIVE_CHANNEL_GROUP_ID=<nip-29-group-id> \
VITE_COMMUNITY_LIVE_FORUM_GROUP_ID=<nip-29-group-id> \
pnpm storybook
```

The registry live story uses the same direct source with
`VITE_REGISTRY_RELAYS`, `VITE_REGISTRY_CURATOR_PUBKEYS`,
`VITE_REGISTRY_PUBLISHER_PUBKEYS`, `VITE_REGISTRY_AUTHORITY_EPOCH`, and
optional `VITE_BLOSSOM_URL`.

Live stories are read-only unless the browser provides a user-controlled
NIP-07 signer. Docker remains the writable WebSocket-backed fixture lane via
`pnpm storybook:relay`.

The Docker stack builds the sibling `nostr-relay`, seeds all complete plugins,
materializes the event graph, builds the sibling site, and serves the rendered
registry at `http://localhost:4321/`.
