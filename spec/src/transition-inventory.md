# Transition inventory

This inventory implements LC-ARCH-008 and LC-ARCH-012. All keys below include
identity and canonical relay unless the resource is explicitly public. A page
owns request cancellation; the session owns live subscriptions. Initial,
cached, empty, refresh, error/retry, replacement and identity-reset transitions
must each be tested before an entry is accepted. A returned collection or
loading flag is never a resource key.

| Surface / operation                | Resource key                                        | Permitted requests and cache                                       | Cancellation and invalidation                 | Regression boundary / state                                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel / forum list               | Conversation, collection                            | Cached window, bounded head, explicit older page                   | History scheduler; relay gaps and membership  | `controller-transitions`, `nip29-history`, `history-pages`: cached/empty/failure, offline pages, deletion controls and visible queue priority; scale pending                              |
| Channel / forum thread             | Conversation, root                                  | Selected thread only; 50 messages                                  | History scheduler; root deletion/access       | NIP-22 root paging, cached root retained during reply refresh, stale older-page tests; expanded scroll race matrix pending                                                                |
| NIP-17 / Buzz DM                   | Transport, participants or channel, root            | Cached envelopes/windows; bounded mailbox scans                    | Identity/session; access and delivery         | Private paging and transport isolation; queued disposal guards passed; broader matrix pending                                                                                             |
| Inbox                              | Identity, filter, selection                         | Shell frame, cached summaries; then activate selected conversation | Controller; live/read/delete updates          | First-frame shell, bounded presentation reads, warm draft restoration and cancelled pre-frame activation covered by InboxShellPaintsBeforeConversationWork; summary paging matrix pending |
| Projects catalog                   | Source, relay, identity, channel                    | Cache then refresh; empty stays resolved                           | Application project session; source/reconnect | Existing empty-catalog lifecycle story; expanded matrix pending                                                                                                                           |
| Project repository / file / review | Coordinate, revision, path or work item             | Identity-scoped cache; selected resource                           | Project request; mutation/revision/access     | Project source/cache contracts; expanded matrix pending                                                                                                                                   |
| Registry catalog / detail          | Trust config, plugin, release                       | Public cache then bounded refresh                                  | Registry session; decision/release/quorum     | Registry source contracts; expanded matrix pending                                                                                                                                        |
| Release supplement                 | Recognized release event ID                         | Inspect release candidates only                                    | Disclosure; trust/revision change             | PluginReleaseMessages and bounded root/reply candidate tests passed                                                                                                                       |
| Agents directory / editor          | Owner, agent, configuration revision                | Directory cache; explicit management refresh                       | Agent session; identity and signed heads      | Agent controller/session tests; expanded matrix pending                                                                                                                                   |
| Agent activity / controls          | Agent, full conversation, request/revision          | Context archive plus live/control subscription                     | Activity view; session retains controls       | Agent context/control tests; hidden-view coverage pending                                                                                                                                 |
| Profiles / settings                | Identity or profile, section, revision              | Cached profile; current section data                               | Application sidebar; relevant events          | Sidebar transition stories; pending                                                                                                                                                       |
| Canvas                             | Scope, channel, identity, revision                  | Single-flight load; save refreshes head                            | Controller; save/access/identity              | Controller single-flight empty canvas and stale resource tests passed; access matrix pending                                                                                              |
| Member search                      | Scope, query, generation, request                   | Local first; current remote result only                            | Controller request identity                   | `controller-transitions.test.ts`: stale results/errors and rapid replacement; cached profile resolution and agent-editor browser contracts                                                |
| Content search / deep links        | Query, scope, target                                | Cached search; bounded target context                              | Controller search/history; query/access       | Search and load-around contracts; pending                                                                                                                                                 |
| Browser Back / Forward             | Destination plus resource keys above                | Same cache policy as direct navigation                             | Application route owner                       | Application navigation stories; pending                                                                                                                                                   |
| Authentication / reconnect         | Identity, relay, session generation                 | Metadata restore; live before gap reconciliation                   | Controller session                            | Late signer results, single-flight sign-out and stale refresh tests passed; relay gap coverage pending                                                                                    |
| Browser cache ownership            | Browser owner context, database name, retention     | One shared initialization; queued reopen after close               | Browser wrapper; last reference owns shutdown | `browser-event-store.test.ts`: repeated open, close during initialization, cross-wrapper and same-wrapper reopen, failed close/retry, degraded recovery; native lock release              |
| Incoming batches / projection      | Verified event IDs, active selection, read revision | Deduplicate; coalesce; retain unchanged model branches             | Runtime/controller generation                 | `projection-state.test.ts`, `controller-transitions.test.ts`; work-bound fixture pending                                                                                                  |
| Reading position / notifications   | Identity, full conversation, viewport               | Saved anchor/draft; canonical unread state                         | Conversation/layout; switch/read/delete       | Virtualized rich history, resize/self-arrival negatives, manual-read and legacy snippet stories passed; full matrix pending                                                               |

The required performance acceptance fixture must contain 50 channels with 1,000 events each,
interleaved DMs, long threads, empty Projects and delayed/failing requests. Its
request, projection, subscription and mounted-row bounds are functional gates.
Production Chrome acceptance measures 20 warm switches with p95 usable paint at
most 150 ms; development-server or automation duration is not that metric.

A 50,000-signed-event memory-cache probe restored metadata without hydrating message history and read a 50-message selected window. This is diagnostic evidence only: the complete CI fixture and production paint gate remain pending. Earlier production Storybook samples measured p95 227 ms and 245 ms, but later inspection found that story autoplay could interfere with those measurements. Rerun the dedicated benchmark with autoplay disabled; those samples do not establish production paint acceptance. Per-relay durable gap recovery, archive-pruning scale bounds, cached Inbox summaries and the complete private notification race matrix still require acceptance. Bounded legacy fallback windows without page coverage now have controller and cold-browser acceptance.

The September 15 real-app Chrome investigation reproduced warm
`plugin-development`/`plugin-releases` switches at p95 2714 ms in the development
build, without channel-history queries. Nested conditional component-prop
factories repeatedly evaluated reading-state getters during row mounting and
teardown. Memoized application/workspace conversation props now have a
cold-browser getter-bound regression; public component contracts are unchanged.
After the correction, isolated 20-switch guest Chrome runs measured p95 344 ms
in the development build and 230 ms in the production build. Longest observed
tasks fell from 2822 ms to 205 ms and 137 ms respectively. These diagnostic
runs time the destination mount plus two animation frames with CPU profiling
enabled; they do not replace the full performance acceptance fixture or meet
the 150 ms target. Neither run issued channel-history queries.
Separate project work-item reads and replaying subscriptions issued 440 relay
requests over 20 warm switches. The project work-item lifecycle still needs
session-scoped resource reuse, independent live observation and selective
invalidation. Manifest bytes are cached, but release-review/inspection models
are also rebuilt on re-entry. These remaining requests and the full production
performance gate are not resolved by the component-prop correction.

`controller-history-lifecycle` also verifies that a refresh snapshot from a previous session is ignored after sign-out; `history-scheduler` covers dynamic priority, eventual hidden work, duplicate requests and per-conversation exclusion. The remaining inventory entries retain their stated pending coverage.

The follow-up project/release slice moves work-item observations into session-owned
repository resources. Unit contracts cover empty/cached visits, cancellation,
coalesced updates, event-ID deletion observation, failed/closed subscriptions,
repository replacement and identity disposal. The warm project-channel Storybook
contract asserts unchanged read, subscription and session counts while navigating
away and back; the Projects activity story covers repository/review surfaces.
Registry source contracts retain inspection/review object identities across warm
reads and unchanged refreshes, and invalidate them on authorization, decision and
withdrawal changes. Release disclosure ignores status-only source updates. Live
Chrome request measurements and final package acceptance are recorded in LC-UI-040.
