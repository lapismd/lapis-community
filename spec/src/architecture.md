# Architecture

## Requirements

| ID          | Requirement                                                                                                                                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-ARCH-001 | The repository MUST publish one package named `@lapismd/lapis-community`; runtime code MUST live beneath `src` and MUST NOT be divided into nested workspace packages.                                                                                                                  |
| LC-ARCH-002 | Signed Nostr events retrieved from configured relays MUST remain the registry source of truth. The package MUST NOT introduce an authoritative registry database or submission API.                                                                                                     |
| LC-ARCH-003 | `src/auth`, `src/nostr`, and `src/protocol` MUST own signer authentication, relay transport/querying, and deterministic event interpretation respectively. Fixture and materializer code MUST remain explicit supporting boundaries under `src`.                                        |
| LC-ARCH-004 | The package MUST expose stable root, `auth`, `nostr`, `protocol`, and `components` entry points without leaking checkout-relative or workspace dependency paths into its publishable manifest.                                                                                          |
| LC-ARCH-005 | Community presentation code and Storybook MUST consume Design Core through its published semantic-version range and public package exports. Direct icon dependencies MAY supply glyphs; local source aliases, file dependencies, and copied Design Core implementations are prohibited. |

The static registry remains a deterministic projection. It can be rebuilt from
the event graph, configured trusted publisher and curator keys, and immutable
content-addressed manifests. The sibling `nostr-plugin-registry` repository owns
the Astro renderer, while the sibling `nostr-relay` repository owns relay
deployment and persistence.
