type InviteLike = {
  code?: string | null;
  inviteLink?: string | null;
} | null;

export function normalizeInviteCode(code: string): string {
  const trimmed = code.trim();
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}

export function buildPublicInviteLink(invite: InviteLike): string {
  if (!invite?.code) return invite?.inviteLink?.trim() ?? "";

  const currentLink = invite.inviteLink?.trim();
  if (
    currentLink &&
    /^https?:\/\//i.test(currentLink) &&
    !/lauda:\/\/member-register/i.test(currentLink) &&
    !/https:\/\/lauda\.app\/convite/i.test(currentLink)
  ) {
    return currentLink;
  }

  return `https://laudaapp.com/convite?code=${encodeURIComponent(invite.code)}`;
}
