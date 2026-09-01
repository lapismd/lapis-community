# Buzz-first registry protocol

The registry is a deterministic view over standard events stored by Buzz. Relay
arrival order, NIP-29 membership, and event storage are not registry authority.

## Groups and events

Group IDs are UUIDv5 values over `registry.lapismd.com/<path>`. The initial
paths are `plugin-releases`, `general`, `plugin-development`, `forums`, and one
`support/<plugin-id>` forum per plugin.

Publishers submit a release as kind `9` in `plugin-releases`. It must carry:

- `h=<plugin-releases group UUID>`;
- `t=lapis-plugin-release`;
- exactly one `t=plugin:<id>`;
- one NIP-92 `imeta` attachment containing `url`, MIME `m`, SHA-256 `x`, and
  `size` for the release manifest.

The manifest retains the exact bundle URL, SHA-256, size, version, platforms,
and compatibility metadata needed by the existing V1 projection. The
materializer fetches the manifest bytes, verifies the attachment hash, confirms
the plugin ID and configured publisher key, and preserves existing bundle
digest/signature validation.

Curators react to the exact release event using kind `7`: `✅` approve, `❌`
reject, and `🚫` revoke. Only configured curator pubkeys count. The latest
trusted decision wins by `created_at`, then lowest event ID. A later rejection
or revocation removes the release from the generated projection without
deleting relay history.

Community streams use kind `9` messages and kind `7` replies/reactions. Forums
use Buzz kinds `45001`, `45003`, and `45002`. Long histories use bounded relay
queries and cursor pagination.

## Determinism and compatibility

The materializer verifies event IDs/signatures, deduplicates replayed events,
applies deterministic decision ordering, sorts output, and hashes canonical
JSON. Identical events, manifests, catalog input, and authority configuration
produce the same root regardless of relay response order.

The V1 HTTP files are a disposable read model over that result. They coexist
with the legacy registry until an explicitly approved cutover. Nostr event
trust is additional to, not a replacement for, plugin bundle signatures.

## Authentication and deferred work

Buzz requires NIP-42 for direct relay operations. The first implementation uses
Nostr-key signers such as NIP-07. OAuth identity bridges, threshold signing,
custom Lapis membership events, and Lapis-specific private-security UI are
deferred. Buzz's native NIP-17/private messaging, media, moderation, search,
workflows, Git, and agent features remain available.

The full deployment decision is recorded in
[`docs/adr/0007-buzz-first-registry.md`](adr/0007-buzz-first-registry.md).
