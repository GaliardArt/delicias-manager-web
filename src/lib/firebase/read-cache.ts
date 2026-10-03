import { auth } from "./config";

const values = new Map<string, unknown>();
const pendingReads = new Map<string, Promise<unknown>>();

function scopedKey(key: string): string {
  return `${auth.currentUser?.uid ?? "anonymous"}:${key}`;
}

/** Keeps a server result in this app session, across route changes. */
export function readThroughCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const fullKey = scopedKey(key);
  if (values.has(fullKey)) return Promise.resolve(values.get(fullKey) as T);

  const pending = pendingReads.get(fullKey);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      values.set(fullKey, value);
      return value;
    })
    .finally(() => {
      if (pendingReads.get(fullKey) === request) pendingReads.delete(fullKey);
    });
  pendingReads.set(fullKey, request);
  return request;
}

export function forgetReadCache(key: string): void {
  const fullKey = scopedKey(key);
  values.delete(fullKey);
  pendingReads.delete(fullKey);
}

export function primeReadCache<T>(key: string, value: T): void {
  values.set(scopedKey(key), value);
}

export function updateReadCache<T>(key: string, update: (current: T) => T): void {
  const fullKey = scopedKey(key);
  if (values.has(fullKey)) values.set(fullKey, update(values.get(fullKey) as T));
}

export interface FirestorePage<T, C> {
  items: T[];
  hasMore: boolean;
  nextCursor: C | null;
}
