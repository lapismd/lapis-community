# Incident response

## First response

1. Open a private incident record with time, reporter, affected environment,
   observed behavior, and currently trusted snapshot/event IDs.
2. Preserve raw relay responses, signed events, service audit records, build
   provenance, and configuration digests. Redact secrets and private identity
   attributes before sharing.
3. Pause the narrowest affected write path: release publication, approval,
   snapshot publication, security dispositions, OAuth onboarding, or a signer
   operator. Keep read-only browsing and verified installation available.
4. Pin consumers to the last complete trusted snapshot, disable live refresh if
   needed, and use the HTTP fallback described in the rollback runbook.
5. Assign incident lead, security decision authority, communications owner, and
   evidence custodian. The suspected identity must not approve its own recovery.

## Incident-specific containment

- **Relay compromise or censorship:** remove the relay from write quorum, query
  exact event IDs from the remaining relays/cache, and compare complete roots.
  A relay response alone never changes approval or security state.
- **Publisher compromise:** pause that publisher, reject new releases, and use a
  distinct registry operator/root path to revoke the publisher or exact release.
  Existing bytes remain governed by their prior exact events and dispositions.
- **Curator compromise:** pause approvals and snapshots, identify decisions
  signed during the exposure window, rotate/revoke the curator grant, and
  rematerialize before publishing a corrective snapshot.
- **Snapshot signer compromise:** stop snapshot publication, pin the last known
  good snapshot, rotate through the root-authorized path, and compare the full
  referenced event set before resuming.
- **Security authority compromise:** stop security publication and use a
  different authorized recovery identity to issue exact corrective or resolved
  dispositions. Community reports cannot substitute for this authority.
- **Threshold operator or nonce incident:** disable the operator, reject the
  round, preserve only redacted round metadata, and rotate/re-share under the
  key ceremony. Never retry with the same round or nonce material.
- **Future OAuth or identity-bridge compromise:** disable onboarding and linking,
  revoke provider credentials, preserve private audit evidence, rotate mapping
  secrets according to the approved migration procedure, and keep existing
  independent Nostr signers usable.
- **Artifact or scanner incident:** block the exact release event and hash, keep
  unrelated versions available, publish a corrected release as new immutable
  bytes, and never overwrite an existing version.

## Recovery and closure

Before resuming writes, verify the new authority set, full materialized roots,
relay quorum, signer one-use-round behavior, static projection, HTTP/Nostr
parity, and installer verification of the same artifact bytes. Publish a public
correction only with explicit approval. Close with a timeline, affected exact
events/hashes, data-exposure assessment, recovery evidence, remaining risks,
and assigned follow-up actions.
