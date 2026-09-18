import { PROJECT_FORGE_KINDS } from "./model.js";

export function repositoryAddress(coordinate: string): {
  owner: string;
  identifier: string;
} {
  const address = coordinate.split(":");
  if (
    address.length < 3 ||
    address[0] !== String(PROJECT_FORGE_KINDS.repository) ||
    !/^[0-9a-f]{64}$/u.test(address[1] ?? "")
  ) {
    throw new Error(
      "Repository reads require a kind 30617 repository coordinate",
    );
  }
  return { owner: address[1]!, identifier: address.slice(2).join(":") };
}

export function repositoryForgePath(
  repository: string,
  action: string,
): string {
  const address = repositoryAddress(repository);
  return `/api/forge/repositories/${address.owner}/${encodeURIComponent(address.identifier)}/${action}`;
}
