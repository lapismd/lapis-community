# Lapis Community

`@lapismd/lapis-community` is the single shared package that turns signed Nostr
events into the verified Lapis registry projection and provides the Svelte
community components embedded by `community.lapis.md`.

The package deliberately keeps relay access, authentication, protocol rules,
materialization, local fixtures, and presentation in separate folders beneath
`src` without creating separately versioned workspace packages.
