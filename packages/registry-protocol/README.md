# @lapismd/registry-protocol

Pure schemas and deterministic projection rules for the Lapis Nostr plugin
registry. The package performs no network or secret-key operations.

The catalog reducer is separate from the security reducer. Security advisories
and authoritative dispositions bind to an exact release event and artifact
digest; ordinary NIP-56 reports cannot produce installer enforcement.

Production callers must inject an approved `RegistryKindMap`. The exported
`TEST_REGISTRY_KINDS` and `TEST_SECURITY_KINDS` exist only for fixtures and do
not identify themselves as production allocations.
