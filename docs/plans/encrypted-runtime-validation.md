# Encrypted runtime snapshots: local validation

Validated on 26 September 2026. This is a local rollout; no packages, images,
branches, or pull requests were published. Visual review remains pending.

## Protocol and behavior

The relay retains the latest encrypted addressable runtime snapshot (30180) and
refresh request (30181) for each owner–agent pair. Kind 24200 progress, control
and replay envelopes remain ephemeral. Runtime refresh returns after publication;
incoming events update shared state independently. A pending request expires after
30 seconds. Cached runtime and its observation time remain available through
refresh failure and timeout.

The controller publishes an initial snapshot from cached catalogs and current
resource readings, then enriches catalogs. Publication ordering and an encrypted
latest-only outbox survive restart. Same-second request ties use Nostr event-ID
ordering; acknowledgements cannot settle a different pending request. Resources
have a two-second sampling deadline and do not start workers. Superseded catalog
results cannot replace a new configuration.

## Passing evidence

- Relay: full Docker `ci-verify.sh`, tagged owner authorization integration,
  snapshot replacement/privacy/signing regressions, and image build. The pinned
  Docker toolchain avoids the host Xcode-license/CGO limitation.
- Controller: `deno task check`, `spec:check`, `test`, and `build`: 383 unit tests
  passed, 3 intentionally skipped, plus 9 Deno runtime/build tests passed.
- Community: 67 focused controller/session/snapshot tests passed, including ten
  real NIP-44 snapshot regressions. History and administration focused tests also
  passed; the history test that timed out under the initial full-suite load passes
  in a bounded-worker run.
- Community: 18 production profile/runtime Storybook interaction/accessibility
  tests passed in fresh browser processes. Static Storybook, package build and
  publint passed. The six packaged-consumer viewport/theme contracts passed.
- Community: canonical specification, architecture and UI-policy checks passed;
  Svelte check reports zero errors/warnings. All changed Svelte modules report
  no autofixer issues; existing advisory suggestions remain in the large facades.

## Local service acceptance

The relay image was rebuilt and recreated first. The operator command rebuilt and
installed both local controller CLIs, then restarted nostr-acp and verified its
managed AI Controller children. Community Vite was restarted from the integrated
primary checkout. Storybook uses the primary checkout on port 7035.

The real signed-in Community agent profile was checked with a cold browser load:

1. Cached runtime appeared while a new request was pending.
2. A successful incoming snapshot updated the observation time and enabled refresh.
3. With nostr-acp stopped, reloading still retrieved cached runtime from the relay.
4. After 30 seconds, the timeout message and retry appeared without clearing data.
5. Restarting nostr-acp delivered a fresh snapshot; explicit retry completed.

PostgreSQL after repeated refreshes and service restart contains one 30180 and one
30181 event, both ciphertext and excluded from the search vector. It contains zero
24200 events. The pre-existing two kind-1631 and two kind-1632 durable JJ events
remain present. Workers remained at zero in the displayed provider resource sample.

## Aggregate limitations accepted for this local rollout

The user explicitly accepted existing Community failures as non-blocking for the
local restart. They are not presented as passing checks:

- Type checking: four Design Core declaration errors involving
  `CyclePickerPreview` and `InlineOptionPickerOption`. Reproduced on the unchanged
  Community parent using the same installed dependency.
- Unit collection: four registry release-edit helper files named `.test.ts` have
  no test suites. The files are unchanged; the empty-suite failure was reproduced
  on the parent. The final bounded-worker full run had 1,247 passing tests, four collection
  failures and two skipped tests; the earlier history timeout did not recur.
- Full Storybook: the first shard recorded 38 App Shell failures and 85 passing
  tests. Later shards did not run because the runner stops on a failed shard.
  The representative Inbox shell restoring failure reproduces on the parent.
- Relay-backed Storybook: 38 passed and 32 App Shell failures; the project-backed
  lane had one App Shell failure with 59 other stories intentionally filtered out.
  These exercise the same existing application boot failures noted above.
- Repository formatting has twelve unchanged failures outside the runtime slice.
  Changed runtime source and protocol prose are formatted.
- The package build reports an existing inferred declaration warning in registry
  `status-options.ts`; the build and publint still exit successfully.
- The relay-to-site smoke script built its images but its fixture could not reach
  the Docker host-gateway relay port (ETIMEDOUT/ENETUNREACH). The live deployed
  relay/controller/browser runtime checks above passed independently.

No assertions, accessibility rules or visual baselines were weakened. No unrelated
source changes were included. Task work was integrated over the existing registry
commit; task-only implementation and baseline workspaces were retired.
