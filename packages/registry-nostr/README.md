# @lapismd/registry-nostr

Relay transport, Buzz registry loading, exact-event resolution, legacy snapshot
loading, and complete-backend fallback for the Lapis registry.

`loadBuzzRelayRegistryState` NIP-42-authenticates when given a signer, reads the
standard release/reaction events, fetches and SHA-256-verifies their NIP-92
manifest attachments, then builds the deterministic registry and V1 projection.

`WebSocketRegistryRelay.authenticate` performs NIP-42 with an external signing
callback and retains that callback for reconnects. Stock Buzz requires NIP-42
for relay reads and writes, so Buzz callers provide a signer before querying as
well as before authoring.

The fallback API returns one whole registry state from Nostr, HTTP, or cache. It
does not expose a row-level merge operation.
