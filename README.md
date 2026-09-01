# Lapis Nostr plugin registry core

This repository is the complete path from signed Nostr registry events to a
verified static projection for `community.lapis.md`.

## Active components

- `@lapismd/registry-protocol` defines standard NIP-29 release messages,
  curator reactions, forum posts, replies, and deterministic projection rules.
- `@lapismd/registry-nostr` reads those events and content-addressed manifests
  from the configured relay.
- `@lapismd/registry-auth` provides NIP-07 and headless signers plus the NIP-42
  authentication adapter used by the browser UI and materializer.
- `apps/registry-community` renders ratings, discussions, replies, reactions,
  and paged thread history directly from the relay.
- `scripts/materialize-registry.ts` verifies publishers, curators, signatures,
  manifests, artifacts, and media before writing the publishable projection.
- `services/registry-local-fixture` creates deterministic local events from the
  sibling `lapis-plugins` checkout for end-to-end testing only.

There is no registry database or submission API. Signed Nostr events and their
content-addressed attachments are the only registry input.

## Materialize

```sh
REGISTRY_RELAYS=wss://relay.example \
REGISTRY_PUBLIC_RELAYS=wss://relay.example \
REGISTRY_PUBLISHER_PUBKEYS=<hex-pubkey> \
REGISTRY_CURATOR_PUBKEYS=<hex-pubkey> \
REGISTRY_READER_SECRET_FILE=/run/secrets/registry-reader \
pnpm registry:materialize --output artifacts/registry
```

The reader file contains a single lowercase hex Nostr secret. It is only an
authenticated read identity for relays that require NIP-42; it is not a
publisher or curator key and must be supplied as a runtime secret.

The output contains the index, plugin details, accepted signed events,
provenance root, browser runtime configuration, mirrored resources, and the
community component. The renderer consumes this directory through
`LAPIS_REGISTRY_SOURCE_DIR` and publishes it under `/registry/`.

## Verify locally

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm local:validate
pnpm smoke:local
```

The Docker stack builds the sibling `nostr-relay`, seeds all complete plugins,
materializes the event graph, builds the sibling site, and serves the rendered
registry at `http://localhost:4321/`.
