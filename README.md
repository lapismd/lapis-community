# Lapis Nostr Plugin Registry

This repository is the Nostr-native successor to the current Lapis plugin
registry. It is being introduced alongside the existing HTTP V1 registry so
that relay publication, deterministic projection, curation, and client fallback
can be proven before any cutover.

## Ownership

- `@lapismd/registry-protocol`: event schemas, authority rules, materializer,
  snapshot roots, and V1 projection.
- `@lapismd/registry-nostr`: relay transport, exact-event resolution, quorum
  publication, cache, and fallback primitives.
- `@lapismd/registry-auth`: signer interfaces and plain-Nostr/OAuth adapters.
- `services/registry-service`: event ingestion, assessment, curation, snapshots,
  and HTTP compatibility projection.
- `services/identity-broker`: passkey-gated identity onboarding and OAuth claims.
- `services/signer-coordinator` and `services/signer-operator`: threshold signing
  orchestration and independently operated shares.
- `apps/registry-console`: separate Nostr preview and curator/admin console.

Relay and Blossom image assembly stays in the sibling `nostr-relay` repository.
Plugin artifacts stay in `lapis-plugins`. The existing public Astro site and V1
analytics stay in `plugin-registry`. Lapis application fallback and caching stay
in `lapis-notes`.

## Trust model

Nostr events add portable identity, review, approval, revocation, and snapshot
provenance. They do not replace the existing bundle digest, bundle signature,
or publisher-key verification. A plugin is visible in the curated projection
only after automated assessment passes and one curator approves it. A distinct
snapshot signer signs deterministic projections.

The official publisher writes to three configured relays and requires two
acknowledgements. Community relay events remain retrievable, while projections
apply published mute/hide decisions and expose excluded-event counts.

## Rollout

The authoritative implementation sequence and gates are recorded in
[`docs/IMPLEMENTATION_LEDGER.md`](docs/IMPLEMENTATION_LEDGER.md). No production
Nostr event, package, image, deployment, key, DNS/OAuth client, or registry
cutover is performed from this repository without explicit approval.

Production preparation and recovery boundaries are indexed in
[`docs/runbooks/README.md`](docs/runbooks/README.md). They are executable
checklists, not authorization to create keys, deploy, publish events, or change
the active registry.

## Local end-to-end stack

Run `pnpm local:up` to build a complete local registry with PostgreSQL, three
official relays, a community relay, generated events from the sibling
`lapis-plugins` checkout, fixture artifacts, and the preview console. Open
<http://localhost:4173/> after Compose reports the services healthy.

The complete lifecycle, safety boundary, configuration overrides, and cold
smoke test are documented in
[`docs/local-testing.md`](docs/local-testing.md).
