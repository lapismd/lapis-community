# Nostr Protocol and Trust

## Requirements

| ID           | Requirement                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-NOSTR-001 | Registry releases, curator decisions, forum topics, replies, and reactions MUST use the standard Nostr event kinds and tag relationships defined by the package protocol implementation.                                                |
| LC-NOSTR-002 | Relay access that requires authentication MUST use NIP-42, and browser publishing MUST remain behind a user-controlled NIP-07 signer.                                                                                                   |
| LC-NOSTR-003 | The materializer MUST verify event signatures and MUST treat release and approval events as authoritative only when their authors match configured trusted publisher and curator keys.                                                  |
| LC-NOSTR-004 | NIP-29 group membership and relay acceptance MUST be treated as transport and moderation controls, not as proof that a registry event is authoritative.                                                                                 |
| LC-NOSTR-005 | Registry projections MUST be deterministic for the same trusted authorities, manifest bytes, event set, and generation timestamp.                                                                                                       |
| LC-NOSTR-006 | Community relay implementations MUST verify published events and provide deterministic filters, counts, live subscriptions, cancellation, replaceable-event handling, and NIP-42 authentication through the public relay contract.      |
| LC-NOSTR-007 | The NIP-29 community source MUST treat relay URL plus group ID as room identity, read authoritative state only from the owning relay, allow configured mirrors to supplement content reads, and publish commands only to the authority. |

Plugin support discussions use one NIP-29 group per plugin. NIP-7D kind `11`
topics, NIP-22 kind `1111` replies, and NIP-25 kind `7` reactions remain
ordinary signed relay events. Clients render them in posting order and retain
reply context without inventing a second persistence model.
