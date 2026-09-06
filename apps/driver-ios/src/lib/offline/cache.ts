import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'offline_cache:';

export async function setCached<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ value, cachedAt: new Date().toISOString() }));
  } catch {
    // Best-effort — a cache write failure shouldn't break the live flow that triggered it.
  }
}

export interface CachedEntry<T> {
  value: T;
  cachedAt: string;
}

export async function getCached<T>(key: string): Promise<CachedEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as CachedEntry<T>) : null;
  } catch {
    return null;
  }
}
