# Registry rollback

Rollback changes the active read/publication path; it never rewrites signed
events or plugin artifacts.

## Triggers

Use rollback for an incomplete or mismatched snapshot, relay quorum loss,
materializer regression, invalid site projection, signer incident, security
feed inconsistency, or unacceptable HTTP/Nostr parity drift.

## Procedure

1. Pause release, approval, security, and snapshot publication as narrowly as
   possible. Record the active and target snapshot IDs and roots.
2. Disable live refresh and pin the previous complete verified snapshot. Reject
   partial event sets even if individual entries appear valid.
3. Restore the prior static site deployment. Keep the current signed V1 tree and
   artifact URLs intact unless their exact signatures or hashes are affected.
4. Set Lapis registry selection back to HTTP and retain its whole last-known-good
   cache. Do not merge HTTP rows with a failed Nostr refresh.
5. Keep authentication, OAuth, ratings, and review writes disabled if they are
   implicated; installation and public read paths must not depend on them.
6. Re-run parity over every plugin/version, bundle hash/signature checks, exact
   event resolution, and cold client acceptance before declaring rollback
   stable.

Re-enabling Nostr requires a new approved window and complete forward
validation. Deleting legacy data, retiring HTTP, repointing DNS, or publishing a
replacement snapshot are separate manual actions, not implied by rollback.
