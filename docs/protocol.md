# Registry event model

Plugin releases use normal NIP-29 kind `9` messages in the deterministic
`plugin-releases` group. The message includes a `plugin:<id>` topic and one
NIP-92 `imeta` attachment pointing to a content-addressed JSON manifest.

The manifest contains both `lapis.registry.plugin/1` metadata and a
`lapis.registry.release/1` release. It is immutable by hash and provides all
data needed to build the published registry without an external catalog.

Curators approve, reject, or revoke a release with kind `7` reactions targeting
the release event. The materializer accepts an approval only from a configured
curator and accepts a release only from a configured publisher. The latest
trusted curator decision wins; ties are resolved by event id. Relay acceptance
alone never makes an event authoritative.

Plugin support uses a deterministic NIP-29 group per plugin. Forum threads are
NIP-7D kind `11` events, replies are NIP-22 kind `1111` comments, and reactions
use NIP-25 kind `7`. The browser reads them directly in bounded pages.
