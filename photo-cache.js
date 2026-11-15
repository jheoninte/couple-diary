// Persistent photo cache. Photos are immutable (UUID names), so once on the device they are never fetched again.
//   iOS app: files in Library/Caches via the DiaryPhotoCache plugin; misses are downloaded in one batch with
//            short-lived signed URLs (one server call per batch), falling back to the server proxy (readPhoto).
//   Browser: Cache Storage with a least-recently-used index.
// Both keep at most 1,500 MB and are cleared on sign-out, account deletion and when the space changes.
export const CACHE_LIMIT_BYTES = 1500 * 1024 * 1024;
export const thumbOf = path => path.replace(/\.jpg$/, '.t.jpg');
const BATCH = 60, BATCH_DELAY = 25;
const OWNER_KEY = 'diary.photoCache.owner.v1', INDEX_KEY = 'diary.photoCache.index.v1', WEB_CACHE = 'diary-photos-v1';

const isNative = () => !!globalThis.window?.Capacitor?.isNativePlatform?.();
let nativePlugin = null;
async function plugin() {
  if (!isNative()) return null;
  if (!nativePlugin) { const { registerPlugin } = await import('@capacitor/core'); nativePlugin = registerPlugin('DiaryPhotoCache'); }
  return nativePlugin;
}

// Batches native photo requests made in the same moment (a feed or album page) into one lookup and one server call.
export function createNativeLoader({ disk, call, toSrc, delay = BATCH_DELAY }) {
  const pending = new Map();
  let timer = null;
  async function run(paths) {
    const done = new Map();
    try { for (const [path, file] of Object.entries((await disk.lookup({ paths })).files || {})) done.set(path, toSrc(file)); } catch {}
    let misses = paths.filter(p => !done.has(p));
    if (misses.length) {
      try {
        const { urls = {} } = await call('photoUrls', { paths: misses });
        const items = misses.filter(p => urls[p]).map(p => ({ path: p, url: urls[p] }));
        if (items.length) for (const [path, file] of Object.entries((await disk.fetch({ items })).files || {})) done.set(path, toSrc(file));
      } catch { /* signing unavailable: use the proxy below */ }
      misses = paths.filter(p => !done.has(p));
    }
    const failed = new Map();
    for (const path of misses) {
      try {
        const { dataUrl } = await call('readPhoto', { path });
        let src = dataUrl;
        try { const saved = await disk.save({ path, dataUrl }); if (saved?.file) src = toSrc(saved.file); } catch {}
        done.set(path, src);
      } catch (e) { failed.set(path, e); }
    }
    return { done, failed };
  }
  async function flush() {
    timer = null;
    const batch = [...pending.entries()]; pending.clear();
    for (let i = 0; i < batch.length; i += BATCH) {
      const chunk = batch.slice(i, i + BATCH);
      const { done, failed } = await run(chunk.map(([path]) => path)).catch(e => ({ done: new Map(), failed: new Map(chunk.map(([p]) => [p, e])) }));
      for (const [path, waiter] of chunk) done.has(path) ? waiter.resolve(done.get(path)) : waiter.reject(failed.get(path) || Error('photo unavailable'));
    }
  }
  return function load(path) {
    if (pending.has(path)) return pending.get(path).promise;
    let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
    pending.set(path, { resolve, reject, promise });
    if (!timer) timer = setTimeout(flush, delay);
    return promise;
  };
}

// Browser: Cache Storage keyed by path, with a size/last-used index in localStorage for the 1,500 MB limit.
function readIndex(storage) { try { return JSON.parse(storage.getItem(INDEX_KEY) || '{}'); } catch { return {}; } }
function writeIndex(storage, index) { try { storage.setItem(INDEX_KEY, JSON.stringify(index)); } catch {} }
export function evictions(index, limit = CACHE_LIMIT_BYTES) {
  let total = Object.values(index).reduce((sum, [size]) => sum + size, 0);
  if (total <= limit) return [];
  const out = [];
  for (const [path, [size]] of Object.entries(index).sort((a, b) => a[1][1] - b[1][1])) { if (total <= limit * 0.9) break; out.push(path); total -= size; }
  return out;
}
const webKey = path => `https://photo-cache.invalid/${encodeURIComponent(path)}`;
export async function webCached(path, download, { storage = globalThis.localStorage, now = Date.now } = {}) {
  const cachesApi = globalThis.caches;
  if (!cachesApi || !storage) return download();
  let cache;
  try { cache = await cachesApi.open(WEB_CACHE); const hit = await cache.match(webKey(path)); if (hit) { const index = readIndex(storage); if (index[path]) { index[path][1] = now(); writeIndex(storage, index); } return hit.blob(); } }
  catch { return download(); }
  const blob = await download();
  try {
    await cache.put(webKey(path), new Response(blob, { headers: { 'content-type': blob.type || 'image/jpeg' } }));
    const index = readIndex(storage); index[path] = [blob.size, now()];
    for (const old of evictions(index)) { delete index[old]; cache.delete(webKey(old)).catch(() => {}); }
    writeIndex(storage, index);
  } catch {}
  return blob;
}

export async function clearPhotoCache() {
  try { await (await plugin())?.clear(); } catch {}
  try { await globalThis.caches?.delete(WEB_CACHE); } catch {}
  try { globalThis.localStorage?.removeItem(INDEX_KEY); globalThis.localStorage?.removeItem(OWNER_KEY); } catch {}
}
// Photos of one person and space stay only while that person is signed in to that space.
export async function claimPhotoCache(owner) {
  let previous = null;
  try { previous = globalThis.localStorage?.getItem(OWNER_KEY); } catch {}
  if (previous && previous !== owner) await clearPhotoCache();
  try { globalThis.localStorage?.setItem(OWNER_KEY, owner); } catch {}
}

let nativeLoad = null;
export async function nativePhoto(path, call) {
  if (!nativeLoad) {
    const disk = await plugin();
    nativeLoad = createNativeLoader({ disk, call, toSrc: file => globalThis.window.Capacitor.convertFileSrc(file) });
  }
  return nativeLoad(path);
}
export { isNative };
