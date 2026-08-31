# @lapismd/registry-auth

Key-custody-free signing and request-authentication boundaries for the Lapis
registry. NIP-07, NIP-46, and host-provided NIP-55 adapters ask an external
signer to sign exact event templates; registry code never receives the private
key. NIP-55 sessions retain only the returned public key and Android signer
package name, enforce requested event kinds, and can be explicitly disconnected.
A generic session wrapper rejects expired requests and results that complete
after logout.

The package also creates and verifies NIP-98 HTTP authorization events, including
exact URL/method, freshness, optional payload digest, and an implementation-level
challenge tag for replay-resistant sensitive operations.
