# Registry identity broker

Private, portable identity-broker core for Google OIDC and GitHub OAuth backed
registry accounts. The broker creates one-use state, nonce, and S256 PKCE
attempts; resolves only the provider's stable subject; and stores an opaque
HMAC lookup rather than a provider id, email, profile, or token.

New accounts cannot complete until an injected WebAuthn verifier confirms user
verification, the browser presents a public threshold-group descriptor, and the
user confirms export of an encrypted recovery package. The public API accepts
only the group pubkey, operator endpoints/public commitments, threshold, and
NIP-46 relays. It has no input for a complete Nostr secret, private operator
share, OAuth token, curator role, or security role.

Provider token exchange and ID-token verification are injected adapters so the
production implementation can use reviewed provider libraries. Google
verification receives the exact nonce, client audience, and allowed issuers.
GitHub resolution accepts only the stable numeric user id. Tokens remain local
to the adapter call and are never returned to the broker or written to audit
records.

This is an interface-level prototype, not production OAuth enablement. OAuth
clients, WebAuthn relying-party configuration, durable private stores, the
threshold engine, recovery ceremony, external security review, and deployment
remain manual gates.
