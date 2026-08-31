# ADR 0002: Nostr kind allocation

- Status: proposed; production gate remains closed
- Date: 2026-08-31

## Current standard kinds

The protocol uses existing meanings where they fit: software application
`32267`, release artifact set `30063`, file metadata `1063`, label `1985`, report
`1984`, and comment `1111`. Those allocations are sourced from the current
[Nostr NIPs event-kind table](https://github.com/nostr-protocol/nips#event-kinds),
with event lifetime and addressability following
[NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md).

Approval, revocation, and deterministic registry snapshot events do not yet have
an approved interoperable allocation. They remain injected through
`RegistryKindMap`. Values `64000` through `64002` are fixture-only and must never
be published. Production publication remains blocked until allocations are
checked against the machine-readable registry of kinds, documented here, and
approved.
