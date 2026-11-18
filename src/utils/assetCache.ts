/**
 * Mandatory Asset Caching & Data Saver Mode Controller
 * Uses browser CacheStorage & localStorage metadata to cache avatars/wallpapers locally
 * while respecting the user's Data Saver toggle (`dataSaverMode`).
 */

const CACHE_NAME = 'shat-masr-assets-v1';
const DATA_SAVER_STORAGE_KEY = 'shat_masr_data_saver_mode';
const CACHED_URL_SET_KEY = 'shat_masr_cached_asset_urls_v1';

const memoryCachedUrls = new Set<string>();

export function isDataSaverEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DATA_SAVER_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDataSaverEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DATA_SAVER_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('shatmasr:datasaver_changed', { detail: { enabled } }));
  } catch {}
}

function recordUrlCached(url: string) {
  memoryCachedUrls.add(url);
  try {
    const raw = localStorage.getItem(CACHED_URL_SET_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(url)) {
      list.unshift(url);
      localStorage.setItem(CACHED_URL_SET_KEY, JSON.stringify(list.slice(0, 120)));
    }
  } catch {}
}

export async function cacheAssetUrl(url?: string | null): Promise<void> {
  if (!url || typeof window === 'undefined') return;
  if (url.startsWith('data:') || url.startsWith('blob:')) return;
  if (isDataSaverEnabled()) return;
  if (memoryCachedUrls.has(url)) return;

  memoryCachedUrls.add(url);

  try {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(url);
      if (!match) {
        await cache.add(url).catch(() => {});
      }
      recordUrlCached(url);
      return;
    }
  } catch {}

  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    recordUrlCached(url);
  } catch {}
}

export async function preloadAppAssets(urls: Array<string | undefined | null>): Promise<void> {
  if (typeof window === 'undefined' || isDataSaverEnabled()) return;
  const unique = Array.from(new Set(urls.filter((u): u is string => Boolean(u && !u.startsWith('data:')))));
  await Promise.all(unique.slice(0, 24).map((u) => cacheAssetUrl(u)));
}
