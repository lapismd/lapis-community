# Key ceremony and rotation

## Scope and roles

Use separate identities for the offline root, catalog curator, snapshot signer,
security advisory authority, security disposition authority, automated
assessor, plugin release publisher, and user threshold groups. A person may
participate in more than one ceremony, but a production service must not reuse
one secret identity across roles.

The offline root never runs in the website, registry console, release CI,
identity broker, coordinator, or operator service. OAuth onboarding grants only
the `user` role; curator and security access requires a separately protected
signing identity.

## Preconditions

- Obtain written approval naming the environment, role, threshold, operators,
  validity window, and recovery policy.
- Pin and independently verify the ceremony tool source revision, build digest,
  protocol/kind ADR, and public configuration schema.
- Use independently administered operator machines and encrypted stores. For
  the prototype use 2-of-3; do not create the planned production 3-of-5 group
  until its cryptographic implementation and operating model have passed an
  external review.
- Assign a facilitator and recorder who do not handle private shares. Establish
  a private incident channel and an abort phrase before starting.
- Disable screen recording, shell history capture, shared clipboards, telemetry,
  and centralized debug logging on ceremony devices.

## Generation checklist

1. Verify every participant and machine out of band; record public device and
   tool attestations only.
2. Each operator generates or receives its share within its own protected
   boundary. A share must never transit the coordinator, broker, facilitator,
   recorder, source repository, ordinary backup, or observability system.
3. Exchange only the protocol-defined public commitments needed to derive and
   verify the group public key.
4. Have every operator independently confirm the group public key, threshold,
   operator set, allowed event kinds, environment, and validity window.
5. Create encrypted recovery material according to the approved recovery
   policy. Record only its digest, storage custodians, copy count, and creation
   time.
6. Perform a non-public test signing round and verify the exact event envelope,
   signature, group public key, one-use round behavior, and redacted audit
   records. Destroy the test event rather than publishing it.
7. Compare all recorded public digests. If any value differs, abort and destroy
   the new shares under witnessed procedure.
8. Seal each operator independently and produce a ceremony record containing
   approvals, participants, public configuration, digests, and result.

Creating grants, publishing public keys/events, loading production shares, or
enabling a service occurs only in a separately approved activation window.

## Rotation and compromise

- Routine re-share preserves the group pubkey only when the reviewed threshold
  engine explicitly supports it and a recovery drill has proved the operation.
- Changing the group pubkey requires new bounded grants, consumer configuration,
  overlap validation, and explicit revocation of the old authority.
- Suspected share compromise pauses that operator and quorum-dependent signing.
  Do not test a suspected share by signing a public event.
- Root, curator, snapshot, or security-key compromise follows the authority-key
  section of the incident runbook. Never use a compromised authority to declare
  itself safe.

## Abort conditions

Abort on an unpinned binary, unexpected network access, incomplete participant
verification, copied or displayed share material, public-key disagreement,
nonce/round reuse, missing recovery receipt, or logging of sensitive payloads.
Preserve redacted evidence and start the incident process before retrying.
