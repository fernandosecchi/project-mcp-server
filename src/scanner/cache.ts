import { config } from "../config.js"

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return null
  }
  return entry.data
}

export function setCached<T>(key: string, data: T, ttlMs: number = config.scanner.cacheTtlMs as number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function invalidate(prefix?: string): void {
  if (!prefix) { store.clear(); return }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = config.scanner.cacheTtlMs
): Promise<T> {
  const hit = getCached<T>(key)
  if (hit !== null) return hit
  const data = await fn()
  setCached(key, data, ttlMs)
  return data
}
