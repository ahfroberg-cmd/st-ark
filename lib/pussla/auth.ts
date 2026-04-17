type SessionUser = { id?: string | null } | null;

type EnsureUserOptions = {
  authUserId?: string | null;
  getSessionUser: () => Promise<SessionUser>;
  onResolvedUser?: (user: SessionUser) => void;
};

export async function ensureUserId(options: EnsureUserOptions): Promise<string> {
  const { authUserId, getSessionUser, onResolvedUser } = options;
  if (authUserId) return authUserId;

  const user = await getSessionUser();
  const userId = user?.id || null;
  if (userId && onResolvedUser) onResolvedUser(user);
  if (!userId) throw new Error("Du ar inte inloggad. Logga in och forsok igen.");
  return userId;
}

export async function resolveUserId(options: EnsureUserOptions): Promise<string | null> {
  const { authUserId, getSessionUser, onResolvedUser } = options;
  if (authUserId) return authUserId;
  const user = await getSessionUser();
  const userId = user?.id || null;
  if (userId && onResolvedUser) onResolvedUser(user);
  return userId;
}
