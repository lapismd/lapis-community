# @lapismd/registry-protocol

Pure schemas and deterministic projection rules for the Lapis Nostr plugin
registry. The package performs no network or secret-key operations.

Production callers must inject an approved `RegistryKindMap`. The exported
`TEST_REGISTRY_KINDS` exists only for fixtures and refuses to identify itself as
a production allocation.
