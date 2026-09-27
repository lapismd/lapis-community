export function createHistoryTargetVisibility(owner: {
  getActiveCommunityId(): string;
  getActiveRoomId(): string;
  getActiveTopicId(): string | undefined;
  getActiveThreadId(): string | undefined;
}) {
  return (scopeId: string, roomId: string, rootEventId?: string): boolean => {
    if (
      scopeId !== owner.getActiveCommunityId() ||
      roomId !== owner.getActiveRoomId()
    )
      return false;
    const topic = owner.getActiveTopicId();
    const thread = owner.getActiveThreadId();
    return rootEventId === undefined
      ? topic === undefined && thread === undefined
      : rootEventId === topic || rootEventId === thread;
  };
}
