# Registry signer coordinator

Lapis-owned threshold-round orchestration behind the `RegistrySigner` boundary.
The coordinator validates a public group profile, reserves a unique round before
contacting operators, asks every independent operator for an opaque partial,
rejects identity mismatches and invalid partials, deterministically selects the
required quorum, and verifies that the aggregate is an exact valid Nostr event.

The prototype demonstrates 2-of-3 behavior, including one unavailable operator,
insufficient quorum, invalid partials, round reuse, and aggregate mutation. The
threshold engine and operator payloads remain opaque interfaces; no Pomegranate,
FROSTR, or other experimental data model is part of the Lapis public contract.
Audit entries contain round outcome and participating operator ids, not event
content, partial signatures, engine context, OAuth identity, or key material.

The included memory round store and test engine are not production crypto.
Production enablement requires durable atomic round storage, authenticated and
bounded operator clients, an externally reviewed FROST-compatible engine,
independent operator deployment, 3-of-5 ceremony approval, recovery/re-sharing,
and a completed nonce-safety review.
