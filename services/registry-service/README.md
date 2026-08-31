# Registry service

Portable Node/Postgres ingestion and preview projection for signed registry
events. POST requests use one-use NIP-98 challenges and the HTTP signer must
match the submitted event author. The database is an event envelope store;
catalog views are deterministic rebuildable projections.

`/preview/v1/*` is deliberately marked unsigned. It must not replace the public
V1 registry until the existing registry-metadata signing path and manual cutover
gate are completed.
