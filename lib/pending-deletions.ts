const STORAGE_PREFIX = "resume-studio-pending-deletions"
const MAX_PENDING_DELETE_AGE_MS = 1000 * 60 * 60 * 24

type PendingDeletionKind = "tracked-runs" | "job-applications"

type PendingDeletionEntry = {
  id: string
  createdAt: string
}

function storageKey(userId: string, kind: PendingDeletionKind) {
  return `${STORAGE_PREFIX}:${kind}:${userId}`
}

function isBrowser() {
  return typeof window !== "undefined"
}

function normalizeEntries(value: unknown): PendingDeletionEntry[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null
    )
    .map((entry) => ({
      id: String(entry.id || ""),
      createdAt:
        typeof entry.createdAt === "string"
          ? entry.createdAt
          : new Date().toISOString(),
    }))
    .filter((entry) => entry.id)
    .filter((entry) => {
      const timestamp = new Date(entry.createdAt).getTime()
      if (Number.isNaN(timestamp)) return true
      return Date.now() - timestamp <= MAX_PENDING_DELETE_AGE_MS
    })
}

function readEntries(
  userId: string,
  kind: PendingDeletionKind
): PendingDeletionEntry[] {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(storageKey(userId, kind))
    if (!raw) return []
    return normalizeEntries(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeEntries(
  userId: string,
  kind: PendingDeletionKind,
  entries: PendingDeletionEntry[]
) {
  if (!isBrowser()) return

  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(storageKey(userId, kind))
      return
    }

    window.localStorage.setItem(
      storageKey(userId, kind),
      JSON.stringify(entries)
    )
  } catch {
    // Ignore localStorage write failures.
  }
}

export function loadPendingDeletionIds(
  userId: string,
  kind: PendingDeletionKind
) {
  const entries = readEntries(userId, kind)
  writeEntries(userId, kind, entries)
  return new Set(entries.map((entry) => entry.id))
}

export function addPendingDeletionId(
  userId: string,
  kind: PendingDeletionKind,
  id: string
) {
  const entries = readEntries(userId, kind).filter((entry) => entry.id !== id)
  entries.unshift({ id, createdAt: new Date().toISOString() })
  writeEntries(userId, kind, entries)
}

export function removePendingDeletionId(
  userId: string,
  kind: PendingDeletionKind,
  id: string
) {
  const entries = readEntries(userId, kind).filter((entry) => entry.id !== id)
  writeEntries(userId, kind, entries)
}
