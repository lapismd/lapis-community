# Registry service

Portable Node/Postgres ingestion and preview projection for signed registry
events. POST requests use one-use NIP-98 challenges and the HTTP signer must
match the submitted event author. The database is an event envelope store;
catalog views are deterministic rebuildable projections.

`/preview/v1/*` is deliberately marked unsigned. It must not replace the public
V1 registry until the existing registry-metadata signing path and manual cutover
gate are completed.

`/preview/community.json` materializes current ratings, NIP-22 reviews, NIP-56
reports, app collections, and follow lists. Active trusted moderation decisions
may hide exact events or mute authors; the response retains separate exclusion
counts. `/preview/security.json` materializes advisories and authorized
dispositions only when their release event and artifact hash resolve to the
approved catalog. Both outputs have independent roots and remain explicitly
unsigned preview data.
