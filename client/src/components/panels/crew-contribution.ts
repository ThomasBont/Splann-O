type CrewParticipantLike = {
  id: number;
  name: string;
  userId?: number | null;
};

type CrewMemberLike = {
  userId: number;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
};

type CrewExpenseLike = {
  amount?: number | string | null;
  participantName?: string | null;
};

export type CrewContributionRow = {
  id: number;
  name: string;
  firstName: string;
  totalPaid: number;
  username: string | null;
  avatarUrl: string | null;
  displayName: string;
  userId: number | null;
  originalIndex: number;
};

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function buildCrewContributionRows({
  participants,
  members,
  expenses,
}: {
  participants: CrewParticipantLike[];
  members: CrewMemberLike[];
  expenses: CrewExpenseLike[];
}): CrewContributionRow[] {
  const paidByName = new Map<string, number>();
  const memberByUserId = new Map<number, CrewMemberLike>();
  const memberByName = new Map<string, CrewMemberLike>();

  for (const expense of expenses) {
    const payerName = String(expense.participantName ?? "").trim();
    if (!payerName) continue;
    paidByName.set(payerName, (paidByName.get(payerName) ?? 0) + Number(expense.amount || 0));
  }

  for (const member of members) {
    if (Number.isFinite(member.userId)) memberByUserId.set(member.userId, member);
    memberByName.set(member.name.trim().toLowerCase(), member);
  }

  return participants
    .map((participant, index) => {
      const linkedMember = (participant.userId ? memberByUserId.get(participant.userId) : null)
        ?? memberByName.get(participant.name.trim().toLowerCase())
        ?? null;
      return {
        id: participant.id,
        name: participant.name,
        firstName: getFirstName(participant.name),
        totalPaid: paidByName.get(participant.name) ?? 0,
        username: linkedMember?.username ?? null,
        avatarUrl: linkedMember?.avatarUrl ?? null,
        displayName: linkedMember?.name ?? participant.name,
        userId: linkedMember?.userId ?? participant.userId ?? null,
        originalIndex: index,
      };
    })
    .sort((a, b) => b.totalPaid - a.totalPaid || a.name.localeCompare(b.name) || a.originalIndex - b.originalIndex);
}
