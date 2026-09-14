# Transition inventory

This inventory implements LC-ARCH-008 and LC-ARCH-012. All keys below include
identity and canonical relay unless the resource is explicitly public. A page
owns request cancellation; the session owns live subscriptions. Initial,
cached, empty, refresh, error/retry, replacement and identity-reset transitions
must each be tested before an entry is accepted. A returned collection or
loading flag is never a resource key.

| Surface / operation                | Resource key                                        | Permitted requests and cache                           | Cancellation and invalidation                 | Regression boundary / state                                                              |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Channel / forum list               | Conversation, collection                            | Cached window, bounded head, explicit older page       | History scheduler; relay gaps and membership  | Controller/source paging; pending                                                        |
| Channel / forum thread             | Conversation, root                                  | Selected thread only; 50 messages                      | History scheduler; root deletion/access       | Thread paging and scroll races; pending                                                  |
| NIP-17 / Buzz DM                   | Transport, participants or channel, root            | Cached envelopes/windows; bounded mailbox scans        | Identity/session; access and delivery         | Private paging and transport isolation; pending                                          |
| Inbox                              | Identity, filter, selection                         | Summary pages; hydrate selected conversation           | Controller; live/read/delete updates          | Inbox paging, draft/selection retention; pending                                         |
| Projects catalog                   | Source, relay, identity, channel                    | Cache then refresh; empty stays resolved               | Application project session; source/reconnect | Existing empty-catalog lifecycle story; expanded matrix pending                          |
| Project repository / file / review | Coordinate, revision, path or work item             | Identity-scoped cache; selected resource               | Project request; mutation/revision/access     | Project source/cache contracts; expanded matrix pending                                  |
| Registry catalog / detail          | Trust config, plugin, release                       | Public cache then bounded refresh                      | Registry session; decision/release/quorum     | Registry source contracts; expanded matrix pending                                       |
| Release supplement                 | Recognized release event ID                         | Inspect release candidates only                        | Disclosure; trust/revision change             | Production conversation story; pending                                                   |
| Agents directory / editor          | Owner, agent, configuration revision                | Directory cache; explicit management refresh           | Agent session; identity and signed heads      | Agent controller/session tests; expanded matrix pending                                  |
| Agent activity / controls          | Agent, full conversation, request/revision          | Context archive plus live/control subscription         | Activity view; session retains controls       | Agent context/control tests; hidden-view coverage pending                                |
| Profiles / settings                | Identity or profile, section, revision              | Cached profile; current section data                   | Application sidebar; relevant events          | Sidebar transition stories; pending                                                      |
| Canvas                             | Scope, channel, identity, revision                  | Single-flight load; save refreshes head                | Controller; save/access/identity              | Controller canvas load/save tests; overlapping-read coverage pending                     |
| Member search                      | Scope, query, generation, request                   | Local first; current remote result only                | Controller request identity                   | `controller-transitions.test.ts`: stale results/errors and rapid replacement             |
| Content search / deep links        | Query, scope, target                                | Cached search; bounded target context                  | Controller search/history; query/access       | Search and load-around contracts; pending                                                |
| Browser Back / Forward             | Destination plus resource keys above                | Same cache policy as direct navigation                 | Application route owner                       | Application navigation stories; pending                                                  |
| Authentication / reconnect         | Identity, relay, session generation                 | Metadata restore; live before gap reconciliation       | Controller session                            | Identity/relay tests; gap coverage pending                                               |
| Incoming batches / projection      | Verified event IDs, active selection, read revision | Deduplicate; coalesce; retain unchanged model branches | Runtime/controller generation                 | `projection-state.test.ts`, `controller-transitions.test.ts`; work-bound fixture pending |
| Reading position / notifications   | Identity, full conversation, viewport               | Saved anchor/draft; canonical unread state             | Conversation/layout; switch/read/delete       | Controlled scroll/notification contracts; pending                                        |

The performance acceptance fixture contains 50 channels with 1,000 events each,
interleaved DMs, long threads, empty Projects and delayed/failing requests. Its
request, projection, subscription and mounted-row bounds are functional gates.
Production Chrome acceptance measures 20 warm switches with p95 usable paint at
most 150 ms; development-server or automation duration is not that metric.
