# Nostr Protocol and Trust

## Requirements

| ID           | Requirement                                                                                                                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-NOSTR-001 | Registry releases, curator decisions, forum topics, replies, and reactions MUST use the standard Nostr event kinds and tag relationships defined by the package protocol implementation.                                                                                                                                                 |
| LC-NOSTR-002 | Relay access that requires authentication MUST use NIP-42, and browser publishing MUST remain behind a user-controlled NIP-07 signer.                                                                                                                                                                                                    |
| LC-NOSTR-003 | The materializer MUST verify event signatures and MUST treat release and approval events as authoritative only when their authors match configured trusted publisher and curator keys.                                                                                                                                                   |
| LC-NOSTR-004 | NIP-29 group membership and relay acceptance MUST be treated as transport and moderation controls, not as proof that a registry event is authoritative.                                                                                                                                                                                  |
| LC-NOSTR-005 | Registry projections MUST be deterministic for the same trusted authorities, manifest bytes, event set, and generation timestamp.                                                                                                                                                                                                        |
| LC-NOSTR-006 | Community relay implementations MUST verify published events and provide deterministic filters, counts, live subscriptions, cancellation, replaceable-event handling, and NIP-42 authentication through the public relay contract. Storybook and conformance lanes MUST seed both implementations with the same signed scenario builder. |
| LC-NOSTR-007 | The NIP-29 community source MUST treat relay URL plus group ID as room identity, read authoritative state only from the owning relay, allow configured mirrors to supplement content reads, and publish commands only to the authority.                                                                                                  |
| LC-NOSTR-008 | Direct messages MUST use NIP-17 sender and recipient gift wraps backed by NIP-44, validate the wrap, seal, and rumor chain before materialization, and remain unavailable when the connected identity lacks encryption support.                                                                                                          |
| LC-NOSTR-009 | Cross-device read markers and preferences MUST use encrypted-to-self kind `30078` events with per-device addressable slots, deterministic monotonic/LWW merging, local-first loading, bounded payloads, and no plaintext logging.                                                                                                        |

Plugin support discussions use one NIP-29 group per plugin. NIP-7D kind `11`
topics, NIP-22 kind `1111` replies, and NIP-25 kind `7` reactions remain
ordinary signed relay events. Clients render them in posting order and retain
reply context without inventing a second persistence model.

Private kind `14` rumors are materialized only after their NIP-17 gift wrap and
kind `13` seal validate and decrypt for the connected identity. Application
state uses eight recent per-device NIP-78 slots, a 32 KiB plaintext ceiling,
two-second debouncing, and message/thread marker pruning before room cursors.
