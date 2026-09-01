# ADR 0003: Identity broker private storage boundary

- Status: deferred design; no implementation is included in the active registry
- Date: 2026-08-31

## Context

Google and GitHub are optional account access and recovery methods. They must
not become the public registry identity, and no Lapis service may persist a
complete OAuth-created Nostr private key. Provider subjects, email addresses,
tokens, passkey identifiers, and recovery metadata are private operational
data, not Nostr events.

## Decision

A future identity broker would own one-use OAuth attempts and opaque provider
mappings. If implemented, its private durable store may use Turso; this database
would not be part of the registry event or projection path. It would store only:

- a digest of the OAuth state plus the short-lived PKCE verifier, nonce,
  redirect URI, provider, and expiry;
- `HMAC(mapping-secret, provider + ":" + stable-subject)` mapped to an internal
  account id;
- the Nostr group pubkey, threshold, operator ids/endpoints/public commitments,
  NIP-46 relay profile, passkey credential id, and recovery-export receipt.

Provider adapters exchange codes and validate provider responses in memory.
Google verification receives the exact nonce, client audience, and issuer
allowlist. GitHub accepts only its stable numeric user id. Provider tokens and
raw subjects are not returned by the broker, included in audit entries, or
published as events.

Durable portable identity/account state is encoded as encrypted, signed Nostr
events. OAuth onboarding is not complete until a WebAuthn verifier confirms user
verification, a public threshold-group descriptor is validated, and an
encrypted recovery package has been exported. OAuth-created accounts receive
only the `user` role. Curator, snapshot, and security authority always require
separate protected Nostr identities.

### Deferred Nostr mapping option

No identity-broker package is included in the active registry. This ADR does not
authorize an implementation, a Turso database, or a durable identity event in
the current relay work.

A future identity-specific ADR may replace the opaque provider-mapping store
with an encrypted, service-signed Nostr event. Such an event would use an opaque
index derived as `HMAC(mapping-secret, provider + ":" + stable-subject)` and
would keep the mapping payload encrypted. It must not contain provider tokens,
raw provider subjects, email addresses, OAuth state, PKCE verifiers, nonces,
passkey challenges, threshold shares, or signing nonces. That design requires a
separate review of uniqueness, relinking, erasure, key rotation, relay
availability, and metadata leakage before implementation.

## Consequences

Any future broker API must have no field for an `nsec`, complete private key,
operator share, or OAuth token. Threshold cryptography, operator deployment,
WebAuthn ceremony verification, durable private storage, account
linking/deletion, and recovery require a separate implementation and production
security review.
