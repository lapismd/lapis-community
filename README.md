# Lapis Nostr Plugin Registry

This repository is the Nostr-native successor to the current Lapis plugin
registry. It is being introduced alongside the existing HTTP V1 registry so
that relay publication, deterministic projection, curation, and client fallback
can be proven before any cutover.

## Ownership

- `@lapismd/registry-protocol`: Buzz group/event contracts, trusted-key rules,
  deterministic materializer, roots, and V1 projection.
- `@lapismd/registry-nostr`: NIP-42 relay transport, manifest verification, and
  Buzz event materialization.
- `@lapismd/registry-auth`: Nostr signer interfaces; identity bridges are
  deferred.
- `apps/registry-console`: browser-side relay reader, publisher, and
  curator/admin console.
- `apps/registry-community`: Design Core custom element for NIP-07/NIP-42 Buzz
  forums, replies, reactions, and paged community reads.
- `scripts/materialize-buzz.ts`: deterministic static V1 output built from
  verified release messages and curator reactions on Buzz.

The stock Buzz compatibility profile remains available through its pinned
container image. The vendored Unicity-derived relay lives in the sibling
`nostr-relay` repository and is exercised by the dedicated Lapis relay Compose
profile.
Plugin artifacts stay in `lapis-plugins`. The existing public Astro site and V1
analytics stay in `nostr-plugin-registry`. Lapis application fallback and
caching stay in `lapis-notes`.

## Trust model

Nostr events add portable identity, review, approval, revocation, and community
history. They do not replace the existing bundle digest, bundle signature, or
publisher-key verification. A plugin release is visible only when submitted by
its configured publisher and its latest trusted curator reaction is `✅`.

The signed Nostr event graph is the source of truth. There is no authoritative
registry database and no HTTP event-submission API. Browsers and build jobs read
NIP-29 messages and reactions from the configured relay, verify their signatures, attached
manifests, publisher keys, and curator keys, and materialize them locally.

The relay stores the standard NIP-29 messages and reactions. Lapis-specific
meaning is applied by clients and materializers, while relay membership and
moderation remain generic community concerns. Static V1 files and browser state are
disposable read models that can always be rebuilt from relay events and their
content-addressed manifests.

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

Run `pnpm local:up` for the fast loop: one stock Buzz relay, generated events from
every complete plugin in the sibling `lapis-plugins` checkout, fixture
artifacts, the direct-relay console, a verified Nostr projection, and the
rendered public registry. The retired multi-relay custom-kind profile is not in
the active developer path. Open the
rendered registry at <http://localhost:4321/> or the operator console at
<http://localhost:4173/> after Compose reports the services healthy.

Run `pnpm local:up:lapis-relay` to build the sibling `nostr-relay` source and
run the same fixture, materializer, console, and rendered site against it. The
cold acceptance command is `pnpm smoke:lapis-relay`; it verifies admin-only
group creation as well as retained registry and forum events.

The complete lifecycle, safety boundary, configuration overrides, and cold
smoke test are documented in
[`docs/local-testing.md`](docs/local-testing.md).
