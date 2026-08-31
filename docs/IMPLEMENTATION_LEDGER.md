# Implementation ledger

Status values are `pending`, `active`, `verified`, `manual-gate`, and `blocked`.
Evidence should name the exact command and owned result. Wider inherited failures
are recorded separately.

| Phase | Ownership                       | Deliverable                                                                         | Status      | Evidence / gate                                                  |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| 0     | this repository                 | repository, ownership contract, ADRs, workspace layout                              | verified    | `pnpm check`; local repository only; no remote                   |
| 1     | protocol                        | schemas, references, authority, deterministic materializer, test vectors            | verified    | `pnpm check`; 6 protocol tests passing                           |
| 2     | Nostr client + relay deployment | exact-id reads, 2-of-3 publisher, locked official and open community Grain profiles | verified    | 5 client tests; relay static/image/policy/full-stack smokes pass |
| 3     | import/projection               | deterministic V1 import and byte-semantic parity report                             | pending     | current `plugin-registry/generated/v1` fixture                   |
| 4     | auth + registry service         | plain Nostr sign-in, shadow submissions, assessment and curator approval            | pending     | local Postgres/service integration                               |
| 5     | curation                        | approval, revocation, moderation, deterministic signed snapshots                    | pending     | replay/shuffle/duplicate test vectors                            |
| 6     | public coexistence              | legacy site consumes HTTP projection; separate Nostr preview console                | pending     | site check/build/browser acceptance                              |
| 7     | Lapis                           | Nostr-primary, HTTP-live fallback, complete last-good cached state                  | pending     | backend matrix and installer acceptance                          |
| 8     | security                        | key ceremony, audit log, backups, recovery drills, operator runbooks                | manual-gate | no production keys in source control                             |
| 9     | community                       | raw event retention plus transparent curated exclusion counts                       | pending     | moderation and provenance acceptance                             |
| 10    | identity                        | passkey-gated OAuth, 2-of-3 prototype, 3-of-5 production ceremony                   | manual-gate | OAuth clients, WebAuthn and operator setup                       |
| 11    | retirement                      | make Nostr default, observe, then retire legacy registry                            | manual-gate | explicit cutover and retirement approval                         |

## Manual gates

The following actions are prepared and validated but never executed implicitly:

1. create a public repository or configure its remote;
2. publish npm packages or container images;
3. create or use production Nostr keys, threshold shares, or recovery material;
4. publish public registry events or approve production plugins;
5. configure production DNS, OAuth clients, passkey origins, or relay endpoints;
6. deploy services, relays, Pages assets, or migrations;
7. switch Lapis defaults, public registry projection, or retire HTTP V1.
