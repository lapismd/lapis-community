# ADR 0008: Lapis Unicity-derived relay profile

- Status: accepted for local implementation; production selection remains gated
- Date: 2026-09-01
- Supersedes in part: ADR 0007 stock-Buzz-only deployment

## Decision

Maintain a sibling `nostr-relay` repository cloned with full history from
Unicity Relay. Record its exact upstream revision and keep Lapis changes in a
reviewable JJ commit on top. Build a Lapis-named container from that source and
exercise it through a separate registry Compose profile before any production
relay decision.

Use the relay's existing NIP-29, NIP-42, NIP-86, PostgreSQL, and Blossom
implementation. Enable its built-in admin-only group creation policy, retain
standard relay validation, and keep registry authority in clients and the
materializer. Do not add a registry submission API or authoritative projection
database.

The Lapis fork contains only compatibility changes demonstrated by automated
tests. In particular, distinct forum events in the `45000` range must not be
collapsed as replaceable events, open-relay Blossom access must follow the
configured relay policy, and generated Blossom URLs must use the configured
public origin.

## Consequences

- `pnpm local:up:lapis-relay` builds the sibling source and runs the complete
  registry fixture, materializer, and site against it.
- `pnpm smoke:lapis-relay` proves group authorization, retained events, signed
  projection verification, and the rendered registry in disposable Docker
  infrastructure.
- `pnpm local:up` and `pnpm smoke:local` retain stock Buzz as a compatibility
  profile while the relay choice is evaluated.
- Upstream provenance and refresh instructions live in `nostr-relay/UPSTREAM.md`.
- Image publication, deployment, production keys/events, DNS, and cutover stay
  behind the existing manual gates.
