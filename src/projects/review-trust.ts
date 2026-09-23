import type { CollaborationAuthority } from "./authority.js";

export function allowsAuthorReviewDecision(options: {
  signer: string;
  author: string;
  repositoryOwner: string;
  isAdmin?: boolean;
}): boolean {
  if (options.signer !== options.author) return true;
  return options.signer === options.repositoryOwner || options.isAdmin === true;
}

export function trustsReviewDecision(
  signer: string,
  author: string,
  repositoryOwner: string,
  authority?: CollaborationAuthority,
): boolean {
  return (
    authority?.canMaintain(signer) === true &&
    allowsAuthorReviewDecision({
      signer,
      author,
      repositoryOwner,
      ...(authority.isAdmin?.(signer) === true ? { isAdmin: true } : {}),
    })
  );
}
