# Local Registry Pipeline

## Requirements

| ID         | Requirement                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LC-OPS-001 | The local Docker Compose stack MUST build this package once, seed deterministic registry and discussion events from `lapis-plugins`, materialize a verified projection, build the sibling registry site, and serve that result with the relay available to the browser. |
| LC-OPS-002 | Fixture and materializer executables MUST be built from `src/fixture` and `src/materializer`; Docker MUST NOT depend on removed workspace-package paths.                                                                                                                |
| LC-OPS-003 | Production publication, trusted-key changes, relay deployment, DNS changes, and package publication MUST remain manual approval gates.                                                                                                                                  |

The local fixture is test infrastructure, not an alternate source of truth. It
publishes the same signed events that production publishers, curators, and
community members would submit and then exercises the normal relay-to-site
pipeline.
