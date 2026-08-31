# Local end-to-end registry testing

The full local stack runs the registry service, PostgreSQL, three official
Grain relays, one community Grain relay, the fixture publisher, and the built
preview console. The fixture publisher reads sibling `lapis-plugins` metadata
from a read-only mount and creates complete plugin, release, assessment,
approval, snapshot, community, and exact-release security events.

## Start the stack

Prerequisites are Docker with Compose, Node 22 or newer, pnpm, and the sibling
`lapis-plugins` and registry-profile `nostr-relay` workspaces.

```sh
pnpm install
pnpm local:validate
pnpm local:up
```

Open <http://localhost:4173/>. Using `localhost` also avoids any existing
service-worker cache registered against a `127.0.0.1` development origin. The
other useful endpoints are:

- registry API: <http://127.0.0.1:8787/preview/v1/index.json>
- fixture and relay verification: <http://127.0.0.1:8090/status.json>
- official relays: `ws://127.0.0.1:8281`, `:8282`, and `:8283`
- community relay: `ws://127.0.0.1:8381`

Use `pnpm local:ps`, `pnpm local:logs`, and `pnpm local:down` for normal
lifecycle work. `pnpm local:reset` also removes the Compose volumes and rotates
the ignored fixture identities.

## What the fixture proves

At startup the fixture service:

1. reads `packages/*/{package.json,manifest.json,registry.json}` from
   `lapis-plugins`, selecting three complete packages by default;
2. creates deterministic source-metadata fixture artifacts with projected
   SHA-256 digests;
3. publishes catalog, workflow, security, and snapshot events to all three
   official relays with a two-of-three retained-copy threshold;
4. publishes ratings, a review, a report, a collection, and a follow list to
   the community relay;
5. submits the same signed events through the registry service's NIP-98
   boundary and verifies every exact official event ID on at least two relays,
   plus every community event on the community relay;
6. serves the generated artifacts and a status document only after seeding and
   verification succeed.

The console starts after that service is healthy, so a loaded catalog reflects
the completed fixture rather than a partially seeded database.

Run `pnpm local:smoke` for an isolated cold build. It uses a unique Compose
project and high local ports, requires two healthy official relays and the
healthy community relay, verifies the complete two-of-three event quorum and
all projections, downloads a projected artifact, checks its digest, checks the
built console, and removes its containers and volumes afterward.

## Configuration and safety

The wrapper prefers `../nostr-relay` when it has the registry Grain profiles,
then falls back to `../nostr-relay-registry`. Override discovery with absolute
`LAPIS_PLUGINS_PATH` or `NOSTR_RELAY_CONTEXT` paths. Set
`REGISTRY_FIXTURE_PLUGIN_LIMIT` to seed more complete packages. All published
host ports can be overridden with the variables in
`deploy/local-e2e.compose.yml`. Event timestamps are stable across fixture
container restarts so relay recovery is idempotent; override
`REGISTRY_FIXTURE_CREATED_AT` when a deliberately fresh local event set is
needed.

Local Nostr secrets are randomly generated under the ignored
`.local/registry-fixture` directory with owner-only permissions. Only public
keys and file paths enter the rendered Compose environment; the secret file
and source checkout are mounted read-only. `.local` is also excluded from the
Docker build context. These test-kind events and source-metadata artifacts are
not production identities, registry approvals, or installable plugin bundles.
