const MAX_LOCAL_CACHE_AGE_MS = 1000 * 60 * 60 * 24 * 30

export function shouldKeepCachedRecord(updatedAt: string | null | undefined) {
  if (!updatedAt) return true

  const timestamp = new Date(updatedAt).getTime()
  if (Number.isNaN(timestamp)) return true

  return Date.now() - timestamp <= MAX_LOCAL_CACHE_AGE_MS
}
