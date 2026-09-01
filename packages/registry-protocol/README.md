# @lapismd/registry-protocol

Pure schemas and deterministic projection rules for the Lapis Nostr plugin
registry. The package performs no network or secret-key operations.

The target protocol is Buzz-first: deterministic NIP-29 group IDs, normal kind
`9` release messages with NIP-92 manifest attachments, trusted kind `7` curator
decisions, and Buzz forum event templates. `materializeBuzzRegistry` keeps
registry authority in configured publisher/curator keys and can project the
result into the existing V1 shape.

It also owns the public self-registration and administrative membership-decision
contracts used by the Lapis relay. Membership is relay admission only;
authoritative catalog and security events still require configured trusted
signers during materialization.

The catalog reducer is separate from the security reducer. Security advisories
and authoritative dispositions bind to an exact release event and artifact
digest; ordinary NIP-56 reports cannot produce installer enforcement.

The older custom-kind contracts remain temporarily for migration evidence.
Production callers using that compatibility path must inject an approved
`RegistryKindMap`. The exported
`TEST_REGISTRY_KINDS`, `TEST_SECURITY_KINDS`, and `TEST_MEMBERSHIP_KINDS` exist
only for fixtures and do not identify themselves as production allocations.
