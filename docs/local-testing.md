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

Run:

```sh
pnpm local:validate
pnpm local:up
# open http://localhost:4321/
pnpm local:down
```

For a clean acceptance run use `pnpm smoke:local`. It allocates isolated ports,
checks NIP-29/NIP-42 support, verifies seeded event counts and projection roots,
loads the community component, downloads a projected artifact, and removes its
containers and volumes on exit.

`pnpm smoke:long-thread` runs the same path with 2,000 forum posts to exercise
bounded thread pagination.
