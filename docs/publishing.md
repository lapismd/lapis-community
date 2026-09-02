# Publishing community.lapis.md

Production publication is a manual gate.

1. Build and test the `@lapismd/lapis-community` package with `pnpm checks`.
2. Supply a dedicated, non-authoritative Nostr read identity through
   `REGISTRY_READER_SECRET_FILE`, then materialize the configured production
   relay into a new empty directory.
3. Archive that directory without changing its contents and record the archive
   SHA-256 digest.
4. Trigger the sibling `nostr-plugin-registry` publish workflow with the
   immutable archive URL and digest.
5. The site workflow verifies Nostr signatures, event ids, projection root,
   plugin files, resource hashes, and relay URLs before building and deploying
   `community.lapis.md`.

Do not reuse a mutable archive URL, expose the reader, publisher, or curator
secret keys to the site build, or deploy a projection that did not pass the
Lapis Community materializer.
