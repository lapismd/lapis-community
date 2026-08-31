# Registry console

Separately deployable preview and operator console for the Nostr-native
registry. Its tiny static server exposes only public relay, kind, and authority
configuration at `config.json`; it does not store or serve registry events.

The browser queries the signed snapshot and exact referenced events directly
over Nostr, verifies them, and deterministically materializes the catalog,
community, and security projections. Workflow and snapshot templates are
signed through a NIP-07 browser extension and the signed events are published
directly to the configured official relay quorum. There is no registry
submission API and no private key enters the console.

Build output is in `dist/`. Deployment, public relay endpoints, production kind
allocation, and authority configuration remain manual gates.
