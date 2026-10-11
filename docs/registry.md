# Registry architecture and materialization

[Package overview](../README.md) · [Usage](usage.md) · [Site publication](publishing.md)

## Source layout

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

## Materialize a verified registry

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

See [local relay-to-site testing](local-testing.md) for the disposable acceptance
stack and [site publication](publishing.md) for the production deployment gate.
