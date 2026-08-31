# Registry console

Static, separately deployable preview and operator console for the Nostr-native
registry. Set the service URL in the UI or pass `?api=https://registry.example/`.
The service must explicitly allow the console origin through
`REGISTRY_CONSOLE_ORIGINS`.

The console treats `/preview/v1/*` as unsigned diagnostic output, checks that
the index and provenance roots agree, and never stores private keys. Workflow
and snapshot templates are signed by a NIP-07 browser extension, then submitted
with a fresh payload-bound NIP-98 challenge signed by the same identity.

Build output is in `dist/` and can be hosted as static assets. Deployment and
production origin configuration remain manual gates.
