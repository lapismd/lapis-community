import type {
  CommunityController,
  CommunityIdentity,
} from "../../community/index.js";
import type { CommunityLoginCredentials } from "../community-login/model.js";

export type DirectCommunityIdentityConnector = (
  methodId: string,
  credentials?: CommunityLoginCredentials,
) => Promise<CommunityIdentity>;

export async function connectDirectApplicationIdentity(
  controller: CommunityController,
  connect: DirectCommunityIdentityConnector,
  methodId: string,
  credentials?: CommunityLoginCredentials,
): Promise<CommunityIdentity> {
  const identity = await connect(methodId, credentials);
  await controller.actions.connectIdentity({ connect: async () => identity });
  return identity;
}
