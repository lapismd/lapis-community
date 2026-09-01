# Registry console

Separately deployable preview and operator console for the Buzz-first
Nostr-native registry. Its tiny static server exposes only public Buzz relay,
catalog, and trusted-key configuration at `config.json`; it does not store or
serve registry events.

The browser NIP-42 authenticates an ephemeral Nostr read session, queries the
stock Buzz relay, fetches release manifests, and applies configured publisher
and curator trust in the Lapis materializer. Publishers can prepare standard
kind 9 release messages and curators can prepare standard kind 7 approval or
rejection reactions. A NIP-07 browser extension signs and publishes the exact
event directly to Buzz. There is no registry submission API, custom workflow
kind, or private key in the console.

Build output is in `dist/`. Deployment, public relay endpoints, and authority
configuration remain manual gates.
