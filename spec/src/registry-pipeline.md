# Local Registry Pipeline

## Requirements

| ID         | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-OPS-001 | The local Docker Compose stack MUST build this package once, seed deterministic registry and discussion events from `lapis-plugins`, include curator-signed publisher authorization events for every seeded plugin, include group-scoped reactions and a threaded channel-reply example, transfer release manifests with relay-compatible standard-base64 Blossom authorization, materialize a verified projection with the complete Community client asset graph, build the sibling registry site, and serve that result with the relay available to the browser.                                                                     |
| LC-OPS-002 | Fixture and materializer executables MUST be built from `src/fixture` and `src/materializer`; Docker MUST NOT depend on removed workspace-package paths.                                                                                                                                                                                                                                                                                                                                                 |
| LC-OPS-003 | Production publication, trusted-key changes, relay deployment, DNS changes, and package publication MUST remain manual approval gates.                                                                                                                                                                                                                                                                                                                                                                   |
| LC-OPS-004 | Controller conformance MUST use one disposable Compose stack with the sibling `nostr-relay` build and PostgreSQL, an isolated project name, allocated loopback port, ephemeral volumes, secret-file relay identity, health check, shared signed seeding, and teardown on test or Storybook exit. Its Docker Storybook lane MUST exercise the full workspace, full application, and complete registry lifecycle stories. The full registry-to-site Compose stack MUST remain a separate final smoke lane. |

The local fixture is test infrastructure, not an alternate source of truth. It
publishes the same signed events that production publishers, curators, and
community members would submit and then exercises the normal relay-to-site
pipeline.

The materializer may use `BLOSSOM_URL` as an image-only fetch base when signed
resource bytes live apart from the relay. This is distinct from the relay's
advertised `BLOSSOM_PUBLIC_URL`: the projection still contains only
hash-verified mirrored resources, and non-image resources retain the legacy
fetch-origin behavior. The final smoke starts a fresh Storybook process against
the seeded relay and artifact server, rejects static index or detail requests,
and exercises Blob-backed AI media in a real browser. It separately retains the
materializer and built Astro route assertions without modifying the sibling
renderer.
