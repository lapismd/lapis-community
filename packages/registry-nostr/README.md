# @lapismd/registry-nostr

Relay transport, exact-event resolution, verified snapshot loading, official
publication quorum, and complete-backend fallback for the Lapis registry.

The fallback API returns one whole registry state from Nostr, HTTP, or cache. It
does not expose a row-level merge operation.
