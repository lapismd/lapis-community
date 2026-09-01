# ADR 0001: Separate Nostr registry with coexistence rollout

- Status: superseded in part by ADR 0005
- Date: 2026-08-31

## Decision

Build the Nostr registry in a new sibling repository. Keep the existing public
registry and V1 distribution operational during shadow publication and parity
validation. The Lapis client eventually selects one complete backend state at a
time: Nostr live, then HTTP live, then last-known-good cache. It never merges
plugin rows from competing backends.

Use two Grain policy classes from the same pinned image: locked official relays
and a separate open, rate-limited community relay. Official publication succeeds
after acknowledgements from two of three configured relays. Portable services
use containers and Postgres. Browser-side registry features may be deployed as
static assets, but Cloudflare-specific storage is not authoritative registry state.

## Consequences

The protocol and V1 projection are independently versioned. The relay deployment
repository remains a deployment owner rather than a fork of Grain. The legacy
site remains available throughout coexistence, and rollback is a backend
selection rather than a destructive data migration.

Custom Nostr kinds remain symbolic until a separate ADR verifies current kind
allocations and interoperability. That gate prevents provisional numbers from
escaping in production events.

The relay choice, Postgres registry store, and HTTP submission boundary in this
historical decision are superseded by ADR 0005. The separate-repository,
coexistence, complete-backend fallback, and production-kind gates remain in
force.
