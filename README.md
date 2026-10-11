# Lapis Community

[![npm version](https://img.shields.io/npm/v/%40lapismd%2Flapis-community)](https://www.npmjs.com/package/@lapismd/lapis-community)

`@lapismd/lapis-community` provides the Nostr protocols, verified plugin
catalogs and Svelte components used by the Lapis community and
`community.lapis.md`.

## What it provides

- Relay access, signing and authentication adapters.
- Verified plugin catalogs and deterministic registry materialization.
- Composable discussions, replies, reactions and bounded thread history.
- Encrypted conversations, Inbox, Agents and project collaboration.

Signed Nostr events and content-addressed resources define the registry.
Your host supplies relay addresses, trusted public keys and authentication,
and owns the lifetime of its sources and controllers.

## Install

```sh
npm install @lapismd/lapis-community svelte
# or
pnpm add @lapismd/lapis-community svelte
```

The package ships ESM and TypeScript declarations. Components require Svelte 5
or newer. Protocol and registry exports can be used independently of the UI.

For the integrated Lapis workspace experience, use the separate
`@lapis-notes/community` plugin through your host.

## Documentation

- [Usage](https://github.com/lapismd/lapis-community/blob/main/docs/usage.md):
  public imports, a typed catalog example, components and source disposal.
- [Registry](https://github.com/lapismd/lapis-community/blob/main/docs/registry.md):
  source layout, materialization and verified resources.
- [Development](https://github.com/lapismd/lapis-community/blob/main/docs/development.md):
  local application, login configuration, Storybook and UI patterns.
- [Local testing](https://github.com/lapismd/lapis-community/blob/main/docs/local-testing.md):
  disposable relay-to-site and project-forge acceptance.
- [Publishing](https://github.com/lapismd/lapis-community/blob/main/docs/publishing.md):
  production registry-site publication.
- [Specification](https://lapismd.github.io/lapis-community/):
  canonical architecture, protocol, component and verification requirements.

## Contributing

Start with the [development guide](https://github.com/lapismd/lapis-community/blob/main/docs/development.md)
and [repository guidance](https://github.com/lapismd/lapis-community/blob/main/AGENTS.md).
