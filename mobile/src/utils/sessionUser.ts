import { User } from "../types";

const MAX_PERSISTED_AVATAR_URL_LENGTH = 512;

export function sanitizeUserForSessionStorage<T extends Partial<User> & { avatarUrl?: string | null }>(user: T): T {
  const { avatarUrl } = user;
  if (
    typeof avatarUrl === "string" &&
    (/^data:/i.test(avatarUrl.trim()) || avatarUrl.length > MAX_PERSISTED_AVATAR_URL_LENGTH)
  ) {
    const { avatarUrl: _omitted, ...lightUser } = user;
    return lightUser as T;
  }

  return user;
}
