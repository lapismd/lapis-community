# ADR 0003: Identity broker private storage boundary

- Status: accepted for prototype; production enablement remains gated
- Date: 2026-08-31

## Context

Google and GitHub are optional account access and recovery methods. They must
not become the public registry identity, and no Lapis service may persist a
complete OAuth-created Nostr private key. Provider subjects, email addresses,
tokens, passkey identifiers, and recovery metadata are private operational
data, not Nostr events.

## Decision

The identity broker owns one-use OAuth attempts and opaque provider mappings.
If prototype interfaces are made durable, their private implementation uses
Turso; this database is not part of the registry event or projection path.
It stores only:

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

## Consequences

The broker API has no field for an `nsec`, complete private key, operator share,
or OAuth token. Threshold cryptography, operator deployment, WebAuthn ceremony
verification, durable private storage, account linking/deletion, and recovery
remain behind interfaces and production security review. An implementation
must restore broker configuration and audit records without reconstructing all
user keys centrally.
