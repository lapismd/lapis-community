# ADR 0005: Relay-authoritative registry with strfry

- Status: accepted
- Date: 2026-08-31
- Supersedes: ADR 0001 relay, registry-database, and submission-API decisions
- Superseded in part by: ADR 0006 relay implementation and membership policy

## Decision

The signed Nostr event graph held by the configured relay set is the registry's
source of truth. Use the official multi-architecture strfry image, pinned by
manifest digest, with the Lapis write-policy plugin supplied by the sibling
`nostr-relay` deployment repository.

Publish signed registry events directly to the official relay set and require
the configured acknowledgement quorum. Publish community events directly to
the community relay. Do not operate a second HTTP event-ingestion path and do
not copy registry events into an authoritative application database.

Readers resolve a trusted signed snapshot from the official relays, fetch its
exact referenced event IDs, verify signatures and authorities, and derive the
catalog deterministically. Community and security views are relay queries over
their governed kinds. Browser state, caches, static V1 JSON, search indexes, and
analytics are disposable read models and must record the source snapshot root.

strfry's LMDB files are relay storage, not a competing registry model. Back up
and restore them as signed event sets. A rebuild may also import a verified
event export into an empty relay and reproduce the same roots.

The optional identity broker is outside the registry data path. If it later
needs durable private OAuth, WebAuthn, session, or deletion-receipt state, use
Turso behind its existing store interfaces. Durable portable identity state
belongs in encrypted, signed Nostr events. Neither category may contain a
complete Nostr private key, and neither becomes registry authority.

## Consequences

- Browser clients and automation sign exact templates and publish them directly to
  relays; relay policy and protocol authority checks are the write boundary.
- Static deployment needs only public relay, kind, and authority configuration.
- Relay indexes answer operational queries; a separate Postgres event table is
  unnecessary and has been removed.
- Losing a cache or static projection does not lose registry state. Losing all
  relay copies and verified exports does, so independent relay/export recovery
  remains mandatory.
- OAuth and passkey enablement still requires a separate security review and
  does not justify a registry database.
