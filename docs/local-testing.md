# Local end-to-end registry testing

The local stack runs the same stock Buzz relay image used by the production
deployment shape. Buzz owns relay persistence in PostgreSQL, transient
coordination in Redis, and media/blob storage in MinIO. Lapis does not add a
registry database or an event-submission API: the signed Nostr graph on Buzz is
the registry source of truth.

The fixture reads the sibling `lapis-plugins` checkout through a read-only
mount. It creates the Lapis NIP-29 groups, uploads content-addressed release
manifests through Buzz's Blossom endpoint, and publishes standard signed
messages, replies, and reactions after NIP-42 authentication. The materializer
derives the disposable V1 tree from those events.

## Run the stack

Prerequisites are Docker with Compose, Node 22 or newer, pnpm, and sibling
`lapis-plugins` and `plugin-registry` workspaces.

```sh
pnpm install
pnpm local:validate
pnpm local:up
```

The services are:

- rendered registry: <http://localhost:4321/>
- registry console: <http://localhost:4173/>
- fixture status: <http://127.0.0.1:8090/status.json>
- Buzz relay and media endpoint: `ws://registry.localhost:8281`

Use `pnpm local:ps`, `pnpm local:logs`, and `pnpm local:down` for the normal
lifecycle. `pnpm local:reset` removes the Buzz PostgreSQL, Redis, MinIO, Git,
projection, and site volumes and rotates the ignored local fixture identities.
There is deliberately one relay profile; the old custom-relay quorum profile
is no longer part of the active developer workflow.

Run `pnpm local:smoke` for a cold production-shaped check. It uses a unique
Compose project and high ports, verifies Buzz NIP-11/NIP-42 behaviour, checks
the retained release and long-forum events, rebuilds the static V1 projection,
builds the public registry, exercises the browser configuration, and removes
its containers and volumes afterward.

## What the fixture proves

At startup the fixture service:

1. reads every complete plugin from `lapis-plugins`;
2. creates the stable `plugin-releases`, `general`, `plugin-development`,
   `forums`, and per-plugin support NIP-29 groups;
3. uploads each release manifest to Buzz/Blossom and publishes a kind `9`
   release submission to `plugin-releases`;
4. publishes a kind `7` curator approval reaction from the configured trusted
   curator key;
5. publishes three forum topics, including a deterministic 240-post thread,
   plus reactions;
6. queries every event back from Buzz and verifies the complete plugin graph;
7. serves only fixture artifacts, the catalog seed, and a status document after
   relay verification succeeds.

The console and public registry read Buzz directly. Browser writes are signed
by a NIP-07 signer and authenticate to Buzz with NIP-42. Release authority is a
client/materializer concern: a release is effective only when its publisher is
trusted for the plugin and its latest decision is a supported reaction signed
by a configured curator key. Buzz remains a general NIP-29 community relay.

## Rebuild the V1 projection

With the stack running, load the generated fixture identity and run:

```sh
set -a
source .local/registry-fixture/fixture.env
set +a
REGISTRY_BUZZ_RELAYS=ws://registry.localhost:8281 \
REGISTRY_PUBLIC_BUZZ_RELAYS=ws://registry.localhost:8281 \
REGISTRY_CATALOG_URL=http://127.0.0.1:8090/catalog.json \
REGISTRY_FIXTURE_SECRETS_FILE=.local/registry-fixture/fixture-secrets.json \
pnpm relay:materialize --output artifacts/local-v1
```

The output contains the V1 index and plugin details, mirrored assets, accepted
Nostr events, provenance, Buzz runtime configuration, and the community browser
bundle. It is a disposable read model and can be rebuilt from Buzz at any time.

## Configuration and safety

Override sibling discovery with absolute `LAPIS_PLUGINS_PATH` or
`PLUGIN_REGISTRY_PATH` paths. Set `REGISTRY_FIXTURE_PLUGIN_LIMIT` to a positive
number for a smaller deliberate fixture. Set
`REGISTRY_FIXTURE_LONG_THREAD_POSTS` to change the primary discussion length;
`pnpm smoke:long-thread` runs the cold stack with 2,000 posts. Host ports and
pinned image references are in `deploy/.env.example`.

The local relay keeps Buzz's rate limiter enabled with higher local-only
ceilings so a deterministic bulk fixture can be imported in one run. Those
overrides live only in `deploy/local-single.compose.yml`; production keeps
Buzz's deployment defaults unless an operator configures them independently.

Local Nostr secrets are generated under ignored `.local/registry-fixture` with
owner-only permissions. Only public keys and the secret-file path enter the
rendered Compose environment; the secret file and source checkout are mounted
read-only. `.local` is excluded from the Docker context. These identities,
events, approvals, and plugin artifacts are local test data only.
