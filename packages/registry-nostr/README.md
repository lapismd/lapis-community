# @lapismd/registry-nostr

Relay transport, exact-event resolution, verified snapshot loading, official
publication quorum, and complete-backend fallback for the Lapis registry.

`WebSocketRegistryRelay.authenticate` performs NIP-42 with an external signing
callback and retains that callback for reconnects. Reads remain anonymous until
authentication is requested; applications authenticate before every
member-authored write and before querying recipient-only gift wraps.

The fallback API returns one whole registry state from Nostr, HTTP, or cache. It
does not expose a row-level merge operation.
