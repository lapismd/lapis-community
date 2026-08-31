# ADR 0004: Threshold topology and nonce-safety boundary

- Status: accepted for interface prototype; production topology is unapproved
- Date: 2026-08-31

## Context

OAuth-backed users need a portable Nostr public key without any single Lapis
service persisting the complete secret. Threshold Schnorr implementations and
their internal data models are still evolving. Nonce reuse, invalid partials,
operator collusion, and an unavailable operator must be handled without making
one experimental library a public registry contract.

## Decision

Lapis owns two opaque interfaces:

- a coordinator engine that prepares per-operator payloads, verifies partials,
  and aggregates an ordinary Nostr event;
- an operator share engine that receives one opaque round payload and returns
  one opaque partial signature.

The interface prototype uses a 2-of-3 group. The coordinator reserves a unique
round before contacting all three operators, verifies each responding operator
identity and partial, deterministically selects two valid participants, and
verifies the final event against the exact requested template and group pubkey.
Each operator independently reserves the group/round pair before its share
engine runs. A failed round is never retried with the same id.

Coordinator and operator audits record public group/round/operator identifiers
and outcomes only. They do not contain engine context, per-operator payloads,
partial signatures, event content, OAuth identity, recovery material, or share
data. The identity broker stores only public group descriptors.

## Consequences

The included engines and memory round stores are test fixtures, not threshold
cryptography. Production requires an externally reviewed FROST-compatible
engine, durable atomic round stores, authenticated bounded transports, isolated
operators, and nonce-failure monitoring. The intended production topology is
3-of-5, but enabling it requires a separate ceremony, recovery/re-sharing
exercise, and explicit approval.

At least one recovery package remains user-controlled. Lapis backup and restore
must recover configuration and audits without centrally reconstructing every
user key. Pomegranate, FROSTR, or another engine may implement the private
adapter, but its internal share or round format is not a Lapis public API.
