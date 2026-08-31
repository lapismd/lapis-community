# Implementation ledger

Status values are `pending`, `active`, `verified`, `manual-gate`, and `blocked`.
Evidence should name the exact command and owned result. Wider inherited failures
are recorded separately.

| Phase | Ownership                       | Deliverable                                                                         | Status      | Evidence / gate                                                          |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| 0     | this repository                 | repository, ownership contract, ADRs, workspace layout                              | verified    | `pnpm check`; local repository only; no remote                           |
| 1     | protocol                        | schemas, references, authority, deterministic materializer, test vectors            | verified    | `pnpm check`; 7 protocol tests passing                                   |
| 2     | Nostr client + relay deployment | exact-id reads, 2-of-3 publisher, locked official and open community Grain profiles | verified    | 5 client tests; relay static/image/policy/full-stack smokes pass         |
| 3     | import/projection               | deterministic V1 import and byte-semantic parity report                             | verified    | 13 signatures; 11 plugins/13 releases round-trip                         |
| 4     | auth + registry service         | plain Nostr sign-in, shadow submissions, assessment and curator approval            | verified    | 8 auth + 3 service tests; NIP-07/46/55; PostgreSQL; cold container smoke |
| 5     | curation                        | approval, revocation, moderation, deterministic signed snapshots                    | verified    | replay/shuffle/duplicate vectors; distinct snapshot signer acceptance    |
| 6     | public coexistence              | legacy site consumes HTTP projection; separate Nostr preview console                | active      | console check/build + cold browser pass; legacy site pending             |
| 7     | Lapis                           | Nostr-primary, HTTP-live fallback, complete last-good cached state                  | pending     | backend matrix and installer acceptance                                  |
| 8     | security                        | key ceremony, audit log, backups, recovery drills, operator runbooks                | manual-gate | no production keys in source control                                     |
| 9     | community                       | raw event retention plus transparent curated exclusion counts                       | verified    | NIP-56 reports retained but cannot moderate; no relay purge              |
| 10    | identity                        | passkey-gated OAuth, 2-of-3 prototype, 3-of-5 production ceremony                   | active      | broker 6 + coordinator 4 + operator 3 tests; crypto/setup remains gated  |
| 11    | retirement                      | make Nostr default, observe, then retire legacy registry                            | manual-gate | explicit cutover and retirement approval                                 |

## Manual gates

The following actions are prepared and validated but never executed implicitly:

1. create a public repository or configure its remote;
2. publish npm packages or container images;
3. create or use production Nostr keys, threshold shares, or recovery material;
4. publish public registry events or approve production plugins;
5. configure production DNS, OAuth clients, passkey origins, or relay endpoints;
6. deploy services, relays, Pages assets, or migrations;
7. switch Lapis defaults, public registry projection, or retire HTTP V1.
