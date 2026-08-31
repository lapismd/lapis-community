# Registry protocol v1

The registry is an event graph with a deterministic curated projection. Relay
arrival order is not authoritative.

## Event graph

1. A publisher signs an addressable software-application event for a plugin ID.
2. The same publisher signs an addressable release-artifact-set event for an
   exact plugin version and bundle SHA-256.
3. A configured assessor signs a label containing automated check results and
   references the exact release event ID and bundle hash.
4. A configured curator signs an approval referencing the exact release,
   passing assessment, plugin version, and bundle hash.
5. Revocations and moderation decisions may remove matching events from the
   curated projection without deleting raw relay history.
6. A distinct snapshot signer signs the materialized root and its complete set
   of accepted event IDs.

An approval is valid only when every reference resolves exactly. One passing
assessment plus one curator approval is required in protocol v1. Event trust is
additional to, not a replacement for, existing bundle signature verification.

## Determinism

The materializer verifies event IDs/signatures, validates content and tags,
deduplicates by event ID, applies Nostr replacement ordering (`created_at`, then
lowest event ID), and sorts all projection collections before hashing canonical
JSON. Identical valid event sets therefore produce the same root when relays
reorder or replay events.

Clients consume one complete materialized snapshot. They never merge individual
plugin rows from a live Nostr result with HTTP V1 or cache rows.

## Kinds

Standard kinds and provisional workflow-kind handling are recorded in
[`docs/adr/0002-nostr-kind-allocation.md`](adr/0002-nostr-kind-allocation.md).
Production callers must inject an approved map; fixture-only kind values are not
an allocation.
