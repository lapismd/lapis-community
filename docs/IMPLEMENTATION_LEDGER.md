# Implementation ledger

Status values are `pending`, `active`, `verified`, `manual-gate`, and `blocked`.
Evidence should name the exact command and owned result. Wider inherited failures
are recorded separately.

This ledger tracks the local coexistence implementation, not the original
plan's production definition of done. `verified` means the named local slice and
its owned tests pass; it does not mean that production keys/events exist, the
public site or app has cut over, or later product/security phases are complete.

| Phase | Ownership                       | Deliverable                                                                    | Status      | Evidence / gate                                                         |
| ----- | ------------------------------- | ------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------- |
| 0     | this repository                 | repository, ownership contract, ADRs, workspace layout                         | verified    | `pnpm check`; local repository only; no remote                          |
| 1     | protocol                        | schemas, references, authority, deterministic materializer, test vectors       | verified    | 19 catalog, security, and community protocol tests passing              |
| 2     | Nostr client + relay deployment | exact-id reads, direct 2-of-3 publishing, strfry policy profiles               | verified    | client tests; strfry policy tests; single/quorum Compose validation     |
| 3     | import/projection               | deterministic V1 import and byte-semantic parity report                        | verified    | 13 signatures; 11 plugins/13 releases round-trip                        |
| 4     | auth + direct publication       | NIP-07/46/55 signing, direct relay submission, assessment and curator approval | verified    | auth tests; direct relay fixture and console; no registry database/API  |
| 5     | curation                        | approval, revocation, moderation, deterministic signed snapshots               | verified    | replay/shuffle/duplicate vectors; distinct snapshot signer acceptance   |
| 6     | public coexistence              | legacy registry remains live; separate direct-relay Nostr console              | verified    | local Docker UI path; legacy signed-source gate `ceed49ed`              |
| 7     | Lapis                           | Nostr-primary, HTTP-live fallback, complete last-good cached state             | verified    | backend matrix and root package acceptance; `0db73f3a`                  |
| 8     | security                        | key ceremony, audit log, backups, recovery drills, operator runbooks           | active      | five runbooks + exact security projection; live drills/ceremonies gated |
| 9     | community                       | raw event retention plus transparent curated exclusion counts                  | verified    | reducer and direct-relay projection scenarios; reports cannot enforce   |
| 10    | identity                        | passkey-gated OAuth, 2-of-3 prototype, 3-of-5 production ceremony              | active      | broker 6 + coordinator 4 + operator 3 tests; crypto/setup remains gated |
| 11    | retirement                      | make Nostr default, observe, then retire legacy registry                       | manual-gate | explicit cutover and retirement approval                                |

## Manual gates

The following actions are prepared and validated but never executed implicitly:

1. create a public repository or configure its remote;
2. publish npm packages or container images;
3. create or use production Nostr keys, threshold shares, or recovery material;
4. publish public registry events or approve production plugins;
5. configure production DNS, OAuth clients, passkey origins, or relay endpoints;
6. deploy services, relays, Pages assets, or migrations;
7. switch Lapis defaults, public registry projection, or retire HTTP V1.

## Cross-repository coexistence evidence

- `plugin-registry` commit `ceed49ed` accepts an alternate complete V1 tree
  only after verifying the repository-pinned Ed25519 trust root, every inline
  and sidecar signature, exact detail-file membership, and release/index
  consistency. Its 83 Node tests, 11 browser tests, focused site checks, and an
  external-source site build passed. The repository's wider `pnpm check`
  remains blocked by inherited generator drift that changes `electron` to
  `desktop` and invalidates 13 existing signatures; generated metadata was not
  re-signed here.
- `lapis-notes` commit `0db73f3a` adds a provider-neutral complete-state
  backend with Nostr primary, live HTTP fallback, and whole last-good cache.
  The 21-case backend matrix, all 765 API tests, spec checks, root check/test,
  build, package build, and publint passed. It never merges rows across
  backends, and the default remains HTTP until the manual cutover gate.

## Remaining before the plan definition of done

- Complete the authority-grant/delegation model and approve the remaining ADRs,
  including snapshot storage, relay retention, artifact mirrors, severity,
  static build triggers, account deletion, and production kind allocation.
- Connect real scanner attestations and the human review queue to protected
  signing and snapshot publication workflows.
- Add static-site and Lapis security-warning/affected-installation surfaces, and
  add the site's rating, review, report, follow, and collection authoring
  islands. The current work provides protocol and preview projections only.
- Select and externally review the threshold cryptographic implementation;
  implement recovery, re-share, provider linking/unlinking, session lifecycle,
  and auditable erasure before any production OAuth identity rollout.
- Run the complete production-like release-to-install and
  advisory-to-fixed-update exercise with released packages and approved test
  infrastructure.
- Complete the explicit publication, deployment, observation, default-cutover,
  and HTTP-retirement gates. Until then, Nostr and HTTP coexist and HTTP remains
  the Lapis default.
