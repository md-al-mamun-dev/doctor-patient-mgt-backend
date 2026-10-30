export interface CachedUser {
  id: string;
  role: 'admin' | 'staff' | 'doctor' | 'patient';
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  passwordChangedAt: Date;
  cachedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL
const userCache = new Map<string, CachedUser>();

export const getCachedUser = (userId: string): CachedUser | null => {
  const entry = userCache.get(userId);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    userCache.delete(userId);
    return null;
  }

  return entry;
};

export const setCachedUser = (
  userId: string,
  user: {
    id: string;
    role: 'admin' | 'staff' | 'doctor' | 'patient';
    status: 'active' | 'disabled';
    mustChangePassword: boolean;
    passwordChangedAt: Date;
  }
): void => {
  userCache.set(userId, {
    ...user,
    cachedAt: Date.now(),
  });
};

export const invalidateCachedUser = (userId: string): void => {
  userCache.delete(userId);
};

export const clearUserCache = (): void => {
  userCache.clear();
};

