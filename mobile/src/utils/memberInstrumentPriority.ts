import { Member } from "../types";

const equivalenceGroups = [
  ["teclado", "tecladista"],
  ["bateria", "baterista"],
  ["vocal", "vocalista"],
  ["violao", "violonista"],
  ["guitarra", "guitarrista"],
  ["baixo", "baixista"],
  ["recepcao", "recepcionista"],
];

export function normalizeInstrumentRoleText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function expandEquivalentTerms(value: string): string[] {
  if (!value) return [];

  const terms = new Set([value]);
  for (const group of equivalenceGroups) {
    if (group.some((term) => value.includes(term))) {
      group.forEach((term) => terms.add(term));
    }
  }

  return Array.from(terms);
}

export function memberMatchesRoleInstrument(member: Member, roleText: string): boolean {
  const normalizedRole = normalizeInstrumentRoleText(roleText);
  if (!normalizedRole) return false;

  const roleTerms = expandEquivalentTerms(normalizedRole);
  return (member.instruments ?? []).some((instrument) => {
    const instrumentTerms = expandEquivalentTerms(normalizeInstrumentRoleText(instrument.name));
    return roleTerms.some((roleTerm) =>
      instrumentTerms.some((instrumentTerm) => roleTerm.includes(instrumentTerm) || instrumentTerm.includes(roleTerm))
    );
  });
}

export function prioritizeMembersByRole(members: Member[], roleText: string): Member[] {
  const sorted = [...members].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" })
  );

  if (!normalizeInstrumentRoleText(roleText)) {
    return sorted;
  }

  return sorted.sort((first, second) => {
    const firstMatches = memberMatchesRoleInstrument(first, roleText);
    const secondMatches = memberMatchesRoleInstrument(second, roleText);

    if (firstMatches === secondMatches) return 0;
    return firstMatches ? -1 : 1;
  });
}
