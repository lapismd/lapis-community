# @lapismd/registry-auth

Key-custody-free signing boundaries for the Lapis registry. NIP-07, NIP-46,
and host-provided NIP-55 adapters ask an external
signer to sign exact event templates; registry code never receives the private
key. NIP-55 sessions retain only the returned public key and Android signer
package name, enforce requested event kinds, and can be explicitly disconnected.
A generic session wrapper rejects expired requests and results that complete
after logout. Signed registry events are published directly to relays; this
package does not define an HTTP event-submission authentication path.

`registerRelayMember` is the shared registration operation for native Nostr,
GitHub, and Google identity entry points once they have resolved a signer. It
signs the public membership registration, NIP-42 authenticates the same key,
and publishes directly to the relay; no application submission API or account
database is involved.

Private vulnerability reports and replies use
`createPrivateSecurityGiftWrap`: a kind-14 rumor whose application payload is
inside a signer-encrypted kind-13 seal, delivered in a NIP-59 kind-1059 gift
wrap. The only public application tag is the recipient `p` tag. Decryption
verifies the outer signature, seal signature, rumor author/hash, and recipient.
Attachment descriptors, including blob location and decryption material, live
inside that encrypted payload.
