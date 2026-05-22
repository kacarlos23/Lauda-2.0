export function toggleLinkedMemberIds(currentIds: string[], memberId: string): string[] {
  if (currentIds.includes(memberId)) {
    return currentIds.filter((id) => id !== memberId);
  }

  return [...currentIds, memberId];
}

export function sortMembersForToggle<T extends { id: string; name: string }>(
  members: T[],
  linkedIds: string[]
): T[] {
  const linked = new Set(linkedIds);

  return [...members].sort((a, b) => {
    const aLinked = linked.has(a.id);
    const bLinked = linked.has(b.id);
    if (aLinked !== bLinked) return aLinked ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  });
}
