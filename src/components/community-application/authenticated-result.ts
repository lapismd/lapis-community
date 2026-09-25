export type CommunityAuthenticatedRunner = (
  action: () => void | Promise<void>,
) => Promise<void>;

export async function runCommunityAuthenticatedResult<T>(
  runAuthenticated: CommunityAuthenticatedRunner,
  action: () => Promise<T>,
  cancelledMessage: string,
): Promise<T> {
  let result: T | undefined;
  await runAuthenticated(async () => {
    result = await action();
  });
  if (result === undefined) throw new Error(cancelledMessage);
  return result;
}
