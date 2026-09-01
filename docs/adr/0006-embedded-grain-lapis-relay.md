# ADR 0006: Embedded Grain Lapis relay

- Status: accepted for implementation; production cutover remains gated
- Date: 2026-09-01
- Supersedes: ADR 0005 strfry deployment and static write-policy decisions

## Context

The registry remains a Nostr event graph, but a static relay kind/pubkey
allowlist cannot express immediate registration, suspension, scoped publisher
permissions, or separate community, curator, and security capabilities. These
rules belong at relay admission without creating an HTTP event-ingestion path
or an authoritative application database.

## Decision

Build one Lapis-specific Go relay executable by composing pinned Grain server
packages. Grain continues to own WebSocket/Nostr handling, nostrdb persistence,
standard validation, signatures, NIP-42, kind `1059` recipient-only reads,
limits, expiration/deletion, NIP-86, and monitoring. Lapis owns only public
membership events, membership resolution, role-aware write admission, trusted
authority configuration, and application defaults.

Add a generic optional write-policy and post-store extension to Grain in a
separate upstream change. Do not copy Grain's event handler or vendor Grain.
The Lapis dependency is pinned to an immutable revision, and the adapter is the
only package that imports Grain server internals.

Membership is public signed Nostr state stored in nostrdb:

- self-registration is signed by and NIP-42-authenticated as the registering
  pubkey and can establish only an active community member;
- a membership administrator can publish a complete decision for a subject,
  including `active`, `suspended`, or `banned` status, additive roles, publisher
  plugin scopes, and a public reason;
- the latest trusted administrative decision wins deterministically and always
  overrides self-registration, so another registration cannot clear a ban;
- active identities receive community capabilities, while publisher, curator,
  and security capabilities require their explicit role and applicable trusted
  authority configuration.

Global Grain authentication remains optional so public reads stay anonymous.
Lapis policy requires NIP-42 for protected writes and normally requires the
authenticated pubkey to equal the event author. Gift wraps are the exception:
kind `1059` has a randomized outer author, so the authenticated sender is
checked independently and Grain's recipient-only query, count, and live-serving
rules remain authoritative.

Private disclosures and replies use NIP-44/NIP-17 payloads inside NIP-59 gift
wraps. Attachments are encrypted before Blossom upload, and their location,
hashes, decryption material, and sensitive vulnerability metadata remain inside
the encrypted conversation. A later public advisory is a separate event.

Nostrdb is the relay's only durable application-state store. A bounded
in-memory membership overlay may provide immediate post-store visibility but is
rebuildable and never authoritative. Generic backup-relay forwarding is
disabled initially for gift-wrap safety; backups use verified nostrdb
snapshots/exports.

The OAuth identity broker remains outside the relay path and unchanged as an
in-memory prototype. Encrypted OAuth-mapping events are deferred by ADR 0003.

## Consequences

- Registration, suspension, and role changes take effect without configuration
  rewrites, restart, or redeployment.
- Relay role policy is defence in depth; clients and materializers continue to
  verify configured publisher, curator, and security identities independently.
- The deployment has one Lapis relay initially, Blossom/object storage, and no
  Postgres, Turso, libSQL, Redis, or registry submission API.
- The existing HTTP registry can coexist as a read-only compatibility surface
  until explicit cutover and retirement approval.
- Grain upstream submission, image publication, production kind allocation,
  production keys/events, DNS, deployment, and retirement remain manual gates.
