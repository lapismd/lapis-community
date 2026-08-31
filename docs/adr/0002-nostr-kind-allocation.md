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

Kind `1984` remains an untrusted NIP-56 report. It is retained for reviewer
context but can never directly hide a catalog entry or change installer policy.
The authoritative Lapis moderation decision is a separate injected workflow
kind.

Approval, revocation, deterministic registry snapshot, authoritative
moderation-decision, security-advisory, and security-disposition events do not
yet have approved interoperable allocations. They remain injected through
`RegistryKindMap` or `SecurityKindMap`. Values `64000` through `64005` are
fixture-only and must never be published. Production publication remains
blocked until allocations are checked against the machine-readable registry of
kinds, documented here, and approved.
