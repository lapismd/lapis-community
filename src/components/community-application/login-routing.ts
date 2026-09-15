import type { CommunityLoginMethodModel } from "../community-login/model.js";

const directHostKeyKinds = new Set<CommunityLoginMethodModel["kind"]>([
  "create-account",
  "private-key",
]);

export function shouldUseDirectApplicationLogin(
  methodId: string,
  methods: readonly CommunityLoginMethodModel[],
  directConnectAvailable: boolean,
): boolean {
  if (!directConnectAvailable) return false;
  const method = methods.find((candidate) => candidate.id === methodId);
  if (method === undefined) return false;
  return directHostKeyKinds.has(method.kind);
}
