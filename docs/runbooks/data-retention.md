# Data retention and deletion

## Principles

Public Nostr events and immutable release artifacts may be replicated beyond
Lapis control and cannot be promised deleted. Account UI and privacy notices
must distinguish local deletion from network-wide erasure. Private provider
mappings, OAuth flow state, passkey metadata, operator material, audit records,
and infrastructure logs stay outside public events.

## Retention classes

- **Permanent public provenance:** accepted definitions, releases, assessments,
  approvals, revocations, moderation decisions, security advisories and
  dispositions, snapshot manifests, and their exact public references.
- **Community relay history:** ratings, reviews, reports, follows, collections,
  and replacement/withdrawal events according to the published relay policy.
  Projection exclusion does not silently purge raw history.
- **Short-lived authentication state:** OAuth state/nonce/PKCE material,
  onboarding tokens, and revoked NIP-46 sessions. If durable storage is needed,
  keep it in the identity broker's private Turso database and erase it promptly
  after use or timeout.
- **Private account state:** opaque provider mappings, account metadata, passkey
  credential identifiers, and recovery receipts. Durable portable identity
  state is an encrypted, signed Nostr event; private provider mechanics may use
  Turso. Retain either only while needed for the account and approved recovery
  obligations.
- **Protected key material:** operator shares and recovery packages remain only
  in their independent encrypted custody. They never enter normal service logs,
  registry backups, analytics, or public events.
- **Operational evidence:** redacted audit, deployment, backup, and incident
  records follow the approved legal/security schedule. Their policy must state
  an owner and deletion review date before production activation.

## Account deletion

1. Step up with a verified passkey or approved recovery method.
2. Revoke active browser and NIP-46 sessions and prevent new threshold rounds.
3. Delete provider mappings and private account records under an auditable,
   idempotent procedure; request each operator to erase its share under its own
   custody policy.
4. Return a receipt describing local systems addressed and the limits of public
   event deletion. Do not publish Google/GitHub identifiers or deletion reasons.
5. Verify backups age out under policy without reconstructing a complete key.

Production retention durations and jurisdictional requirements require explicit
privacy/security approval; this repository intentionally does not invent them.
