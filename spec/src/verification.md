# Verification

| ID           | Status         | Evidence                                                                                                                          |
| ------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| LC-ARCH-001  | Implemented    | `package.json`; `src`; `pnpm spec:check`                                                                                          |
| LC-ARCH-002  | Implemented    | `src/nostr`; `src/materializer`; `pnpm test`                                                                                      |
| LC-ARCH-003  | Implemented    | `src/auth`; `src/nostr`; `src/protocol`; `src/fixture`; `src/materializer`                                                        |
| LC-ARCH-004  | Implemented    | `package.json`; `pnpm build`; `pnpm prepack`                                                                                      |
| LC-ARCH-005  | Implemented    | `package.json`; public `@lapismd/design-core` imports; `pnpm-lock.yaml`                                                           |
| LC-ARCH-006  | Visual pending | Public `CommunityAppShell`; shared Inbox, channel, thread, channel-settings, and shell-backed preview composition                 |
| LC-ARCH-007  | Implemented    | shared relay factory across memory, Docker, and non-seeding NIP-07-gated live Storybook runtimes                                  |
| LC-ARCH-008  | Implemented    | `src/community/community-controller.svelte.ts`; normalized profile, reply-participant, and latest-activity projection             |
| LC-ARCH-009  | Implemented    | `src/auth`; `src/community/state-store.ts`; signer and state-store tests                                                          |
| LC-NOSTR-001 | Implemented    | `src/protocol/nip29.ts`; `src/protocol/nip29.test.ts`                                                                             |
| LC-NOSTR-002 | Implemented    | `src/auth`; `src/nostr/transport.ts`; `pnpm test`                                                                                 |
| LC-NOSTR-003 | Implemented    | `src/protocol/projection.ts`; `src/nostr/nip29-state.test.ts`                                                                     |
| LC-NOSTR-004 | Implemented    | `src/protocol/nip29.ts`; `src/nostr/nip29-state.ts`                                                                               |
| LC-NOSTR-005 | Implemented    | `src/protocol/canonical.ts`; `src/protocol/nip29.test.ts`                                                                         |
| LC-NOSTR-006 | Implemented    | shared relay contract tests; in-memory and WebSocket relay implementations                                                        |
| LC-NOSTR-007 | Implemented    | `src/community/nip29-community-source.ts`; kind `0` profile and NIP-30 custom-emoji controller projections and commands           |
| LC-NOSTR-008 | Implemented    | `src/community/nip17.ts`; direct-message and controller integration tests                                                         |
| LC-NOSTR-009 | Implemented    | `src/community/state-store.ts`; browser, encrypted relay, merge, and ciphertext tests                                             |
| LC-UI-001    | Implemented    | `src/components`; `pnpm build-storybook`                                                                                          |
| LC-UI-002    | Implemented    | `src/components/registry-community/RegistryCommunity.svelte`; component folders                                                   |
| LC-UI-003    | Implemented    | `src/components/registry-community/registry-community-controller.svelte.ts`; component stories                                    |
| LC-UI-004    | Implemented    | `src/components/discussion-post-stream`; `src/components/discussion-timeline`; unit tests                                         |
| LC-UI-005    | Visual pending | `pnpm test:storybook`; `pnpm build-storybook`; human baseline approval pending                                                    |
| LC-UI-006    | Implemented    | `src/components/community-workspace/model.ts`; controlled community component props                                               |
| LC-UI-007    | Implemented    | `src/components/community-app-shell/CommunityAppShell.svelte`; Design Core App Shell compound regions and controller              |
| LC-UI-008    | Implemented    | `src/components/community-conversation`; `src/components/community-message`; `pnpm test:storybook`                                |
| LC-UI-009    | Implemented    | `.storybook/preview.ts`; `.storybook/manager-color-mode-toggle.tsx`; semantic-token styles                                        |
| LC-UI-010    | Visual pending | Ordered Navigation, Inbox, Channels, Forums, Discussion, Registry, and Examples catalog sections; human review pending            |
| LC-UI-011    | Visual pending | `src/components/community-application`; full controller-routed app story plus retained focused App Shell examples                 |
| LC-UI-012    | Visual pending | Shared production app frame, edge-to-edge compact header, collapsed-rail alignment, and joined panel shape; human review pending  |
| LC-UI-013    | Visual pending | Settings sidebar replacement; hover states; centered Image/Emoji avatar editor; controller-persisted saves; human review pending  |
| LC-UI-014    | Visual pending | Compact Inbox thread rows; aligned metadata and avatar-led relative reply activity across conversations; human review pending     |
| LC-UI-015    | Visual pending | Inbox menus and joined Buzz-style channel/forum settings with room-specific labels and unsupported actions hidden                 |
| LC-UI-016    | Visual pending | Buzz-style channel action cards; forum index without details, self-sizing rows and Back to posts; joined headers; review pending  |
| LC-UI-017    | Visual pending | controller-backed composed stories; 18-file story audit; memory/Docker toolbar selector; human review pending                     |
| LC-UI-018    | Visual pending | complete `RegistryCommunity` lifecycle story; shared registry data source and signed memory/Docker scenario; human review pending |
| LC-OPS-001   | Implemented    | `deploy/local.compose.yml`; `pnpm local:smoke`                                                                                    |
| LC-OPS-002   | Implemented    | `deploy/fixture.Dockerfile`; `src/fixture`; `src/materializer`                                                                    |
| LC-OPS-003   | Implemented    | `AGENTS.md`; `docs/publishing.md`                                                                                                 |
| LC-OPS-004   | Implemented    | `deploy/community-relay.compose.yml`; `scripts/community-relay.sh`; shared memory/Docker relay contract suite                     |
| LC-SPEC-001  | Implemented    | `spec/book.toml`; `pnpm spec:build`                                                                                               |
| LC-SPEC-002  | Implemented    | `spec-validator.config.mjs`; `pnpm spec:first`                                                                                    |
| LC-SPEC-003  | Implemented    | `spec-validator.config.mjs`; `pnpm spec:check`                                                                                    |
| LC-SPEC-004  | Implemented    | `.storybook/preview.ts`; memory default, optional Docker, non-seeding live registry selector, and full-viewport shell marker      |
| LC-SPEC-005  | Implemented    | `AGENTS.md`; Storybook regression-prevention and workspace-isolation guidance                                                     |
