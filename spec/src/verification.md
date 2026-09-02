# Verification

| ID           | Status         | Evidence                                                                                                               |
| ------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| LC-ARCH-001  | Implemented    | `package.json`; `src`; `pnpm spec:check`                                                                               |
| LC-ARCH-002  | Implemented    | `src/nostr`; `src/materializer`; `pnpm test`                                                                           |
| LC-ARCH-003  | Implemented    | `src/auth`; `src/nostr`; `src/protocol`; `src/fixture`; `src/materializer`                                             |
| LC-ARCH-004  | Implemented    | `package.json`; `pnpm build`; `pnpm prepack`                                                                           |
| LC-ARCH-005  | Implemented    | `package.json`; public `@lapismd/design-core` imports; `pnpm-lock.yaml`                                                |
| LC-ARCH-006  | Visual pending | Consolidated `Community/Examples/App Shell` Inbox, channel, and thread stories; duplicate shell entry removed          |
| LC-NOSTR-001 | Implemented    | `src/protocol/nip29.ts`; `src/protocol/nip29.test.ts`                                                                  |
| LC-NOSTR-002 | Implemented    | `src/auth`; `src/nostr/transport.ts`; `pnpm test`                                                                      |
| LC-NOSTR-003 | Implemented    | `src/protocol/projection.ts`; `src/nostr/nip29-state.test.ts`                                                          |
| LC-NOSTR-004 | Implemented    | `src/protocol/nip29.ts`; `src/nostr/nip29-state.ts`                                                                    |
| LC-NOSTR-005 | Implemented    | `src/protocol/canonical.ts`; `src/protocol/nip29.test.ts`                                                              |
| LC-UI-001    | Implemented    | `src/components`; `pnpm build-storybook`                                                                               |
| LC-UI-002    | Implemented    | `src/components/registry-community/RegistryCommunity.svelte`; component folders                                        |
| LC-UI-003    | Implemented    | `src/components/registry-community/registry-community-controller.svelte.ts`; component stories                         |
| LC-UI-004    | Implemented    | `src/components/discussion-post-stream`; `src/components/discussion-timeline`; unit tests                              |
| LC-UI-005    | Visual pending | `pnpm test:storybook`; `pnpm build-storybook`; human baseline approval pending                                         |
| LC-UI-006    | Implemented    | `src/components/community-workspace/model.ts`; controlled community component props                                    |
| LC-UI-007    | Implemented    | `src/components/community-workspace/CommunityWorkspaceStoryHarness.svelte`; public component exports                   |
| LC-UI-008    | Implemented    | `src/components/community-conversation`; `src/components/community-message`; `pnpm test:storybook`                     |
| LC-UI-009    | Implemented    | `.storybook/preview.ts`; `.storybook/manager-color-mode-toggle.tsx`; semantic-token styles                             |
| LC-UI-010    | Visual pending | Ordered Navigation, Inbox, Channels, Forums, Discussion, Registry, and Examples catalog sections; human review pending |
| LC-UI-011    | Visual pending | `src/components/community-workspace/CommunityWorkspace.stories.svelte`; consolidated public Design Core shell examples |
| LC-UI-012    | Implemented    | fullscreen shell story interaction assertions; `pnpm test:storybook`                                                   |
| LC-UI-013    | Visual pending | `src/components/community-navigation`; navigation, sorting, and action-menu stories; human review pending              |
| LC-UI-014    | Visual pending | Inbox row-composer and message states in `Community/Examples/App Shell/Inbox`; human review pending                    |
| LC-UI-015    | Visual pending | Inbox menus, joined inline right sidebar, and channel welcome settings treatment; human review pending                 |
| LC-UI-016    | Visual pending | `Community/Examples/App Shell/Desktop channel` and `Channel thread open`; live Buzz comparison; human review pending   |
| LC-OPS-001   | Implemented    | `deploy/local.compose.yml`; `pnpm local:smoke`                                                                         |
| LC-OPS-002   | Implemented    | `deploy/fixture.Dockerfile`; `src/fixture`; `src/materializer`                                                         |
| LC-OPS-003   | Implemented    | `AGENTS.md`; `docs/publishing.md`                                                                                      |
| LC-SPEC-001  | Implemented    | `spec/book.toml`; `pnpm spec:build`                                                                                    |
| LC-SPEC-002  | Implemented    | `spec-validator.config.mjs`; `pnpm spec:first`                                                                         |
| LC-SPEC-003  | Implemented    | `spec-validator.config.mjs`; `pnpm spec:check`                                                                         |
| LC-SPEC-004  | Implemented    | `package.json`; `.storybook/preview.ts`; `pnpm checks`                                                                 |
| LC-SPEC-005  | Implemented    | `AGENTS.md`; Storybook regression-prevention and workspace-isolation guidance                                          |
