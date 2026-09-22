# Local relay-to-site test

The local stack contains only the services required to exercise production
data flow:

1. the sibling `nostr-relay` and its PostgreSQL storage;
2. a fixture that reads the sibling `lapis-plugins` checkout and publishes
   signed NIP-29 events plus content-addressed manifests;
3. the registry materializer;
4. the sibling Astro site builder and static server.

The fixture creates an ignored, mode-`0600` reader key file. The materializer
uses that non-authoritative identity for the relay's required NIP-42 handshake;
the key is never written into the projection or Compose environment.

The persistent cluster is the sibling `community-local` CLI. Disposable
relay-to-site acceptance stays in this package:

```sh
pnpm local:validate
community-local up
# open the site with: community-local site
community-local down
```

For a clean acceptance run use `pnpm smoke:local`. It allocates isolated ports,
checks NIP-29/NIP-42 support, verifies seeded event counts and projection roots,
loads the community component, downloads a projected artifact, and removes its
containers and volumes on exit.

`pnpm smoke:long-thread` runs the same path with 2,000 forum posts to exercise
bounded thread pagination.

## Project forge Storybook lane

The project workspace has a separate Docker acceptance lane because hosted
repository browsing is backed by WalGit rather than by a local checkout. Run:

```sh
pnpm test:storybook:projects-docker
```

This starts the sibling relay, PostgreSQL, WalGit, RustFS, and the idempotent
bucket initializer with disposable runtime credentials. The application story
then publishes its project, hosted-repository, task, pull-request, and review
events through the real WebSocket and NIP-98 paths before exercising the
Buzz-aligned project workspace. The fixture also waits until the clone-less
repository announcement resolves through the relay's authenticated hosted-refs
gateway, proving that reconciliation reached WalGit. `pnpm
storybook:projects-relay` starts the same stack for interactive inspection.
Both commands remove their containers, volumes, and generated credentials when
they stop.

Community owns this browser/client contract. The sibling relay owns Git
gateway authorization, object-store recovery, and the tagged end-to-end Git
test described in `../nostr-relay/WALGIT_INTEGRATION.md`. GitHub merge,
provider-neutral CI, and repository import are implemented relay foundations.
Remaining native WalGit coordination and provider coverage are documented in
`../nostr-relay/spec/src/roadmap/deferred-forge-work.md`; Community-facing
scope is tracked in `spec/src/deferred-work.md`.
