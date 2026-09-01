# Nostr-native Lapis registry

This repository owns the Nostr protocol, deterministic registry materializer,
relay client, registry identity/authentication services, curation workflow, V1
projection tooling, and community browser component. It does not own plugin artifacts, the
legacy registry site, the Lapis installer, or relay image assembly.

- Keep Nostr kind numbers injected through `RegistryKindMap` until the kind ADR
  is approved. Do not publish production events with provisional kind numbers.
- Preserve existing plugin-bundle hashing and Ed25519 verification. Registry
  events describe and approve artifacts; they do not replace artifact trust.
- Materialization must be deterministic across relay order, duplicates, and
  replay. Add fixture evidence for authority, references, revocation, and root
  calculation changes.
- Keep signers behind the `RegistrySigner` boundary. Never commit or log Nostr
  secret keys, OAuth secrets, passkey private material, recovery shares, or
  production relay credentials.
- The official registry is curated. Automated assessment and curator approval
  are separate from snapshot signing.
- Community relay data may be retained as events, but user-facing projections
  must apply transparent moderation decisions and expose exclusion counts.
- Start validation at the narrowest affected package, then run root `pnpm
check`. Cross-repository changes additionally require focused acceptance in
  every affected owner.
- Use Jujutsu for repository operations and commit each verified slice.
- npm publication, public keys/events, container publication, DNS/OAuth setup,
  deployment, cutover, and retirement are manual gates requiring explicit user
  approval.
