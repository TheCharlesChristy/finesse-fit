/**
 * Reading text out of a photo of a nutrition label with Tesseract.
 *
 * tesseract.js and wasm-feature-detect are loaded on demand (`import()`),
 * not from App's main bundle, since most sessions never open this flow. Both
 * run from files this app ships under `public/tesseract/`, not a CDN: the
 * worker, the wasm core and the English language data are same-origin, so a
 * label photo's pixels never leave the device and OCR keeps working offline
 * once the service worker has cached them (see the `runtimeCaching` entry in
 * vite.config.js). This is a different exception to the "no network calls"
 * rule than `foodApi.js` — that module sends bytes describing food (a
 * barcode, search words) to Open Food Facts; this one only ever fetches its
 * own static engine files, once, and never sends anything anywhere.
 *
 * Only the SIMD build of tesseract-core is shipped, and `corePath` below
 * points at that exact file rather than a directory — tesseract.js's own
 * feature-detection otherwise reaches for a "relaxed SIMD" build this app
 * doesn't ship, which would 404 on a browser that happens to support it. A
 * device too old for SIMD wasm gets a clear error instead of a silent hang;
 * that trade keeps a second multi-megabyte core out of the app entirely.
 *
 * Genuinely unsupported hardware is rare — essentially every device still
 * receiving updates has had WASM SIMD for years. Far more likely is a
 * *transport* failure: the core is 2.86MB and its glue script another
 * 3.9MB, a lot to ask a phone on a shaky connection to fetch in one piece,
 * and the `runtimeCaching` rule in vite.config.js means a response that got
 * cut off mid-download can end up cached and replayed forever after, since
 * CacheFirst never re-validates against the network. `simd()` from
 * `wasm-feature-detect` settles which of the two happened *before* the
 * multi-megabyte fetch even starts, with a few bytes of throwaway wasm — so
 * a genuine incompatibility is never confused with a bad download, and a bad
 * download gets its cache entry cleared and one automatic retry rather than
 * failing the same way forever.
 */

import { simd } from 'wasm-feature-detect';

const ASSET_BASE = `${import.meta.env.BASE_URL}tesseract/`;
const CORE_URL = `${ASSET_BASE}core/tesseract-core-simd-lstm.wasm.js`;
const CORE_WASM_URL = `${ASSET_BASE}core/tesseract-core-simd-lstm.wasm`;
const OCR_CACHE_NAME = 'ocr-assets';

export class OcrUnsupportedError extends Error {
  constructor() {
    super('This device or browser doesn’t support the WebAssembly features label scanning needs.');
    this.name = 'OcrUnsupportedError';
  }
}

/** An error tagged with which named step of the pipeline it happened in — the
 * only diagnosis a phone with no devtools can give when recognition fails. */
export class StageError extends Error {
  constructor(stage, cause) {
    super(`${stage}: ${cause?.message || String(cause)}`);
    this.name = 'StageError';
    this.stage = stage;
    this.cause = cause;
  }
}

async function withStage(stage, fn) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof OcrUnsupportedError) throw error;
    throw new StageError(stage, error);
  }
}

/** Drop any cached copy of the wasm core, in case it was cached mid-download. */
async function evictCachedCore() {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(OCR_CACHE_NAME);
    await Promise.all([cache.delete(CORE_URL), cache.delete(CORE_WASM_URL)]);
  } catch {
    // Best effort — Cache Storage can be unavailable (private browsing,
    // Safari's own quirks); the caller's retry still helps even without it.
  }
}

let simdSupported = null;

async function createOcrWorker(onProgress) {
  if (simdSupported == null) simdSupported = await simd().catch(() => false);
  if (!simdSupported) throw new OcrUnsupportedError();

  const { createWorker } = await import('tesseract.js');
  try {
    return await createWorker('eng', undefined, {
      workerPath: `${ASSET_BASE}worker.min.js`,
      corePath: CORE_URL,
      langPath: `${ASSET_BASE}lang`,
      logger: onProgress
    });
  } catch (error) {
    // SIMD is confirmed supported above, so a WebAssembly compile/link
    // failure here isn't a real incompatibility — almost certainly a
    // truncated download, possibly one the service worker cached partway
    // through. Clear it so the retry the caller gets to offer fetches fresh.
    const isWasmError = typeof WebAssembly !== 'undefined'
      && (error instanceof WebAssembly.CompileError || error instanceof WebAssembly.LinkError);
    if (isWasmError) await evictCachedCore();
    throw error;
  }
}

let workerPromise = null;

function getOcrWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = createOcrWorker(onProgress).catch((error) => {
      // A failed load must not wedge every later attempt behind the same
      // rejected promise — worth letting the user try again.
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/** Release the OCR worker's memory. Safe to call whether or not one was ever created. */
export async function terminateOcr() {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Already gone, or never finished loading — nothing to clean up.
  }
}

/**
 * Recognise the text in a nutrition-label photo. `source` is anything
 * tesseract.js accepts directly — a File/Blob from a file input works fine,
 * no canvas step needed. `onProgress` receives tesseract's own logger
 * events (`{ status, progress }`) for a progress bar.
 */
export async function recognizeLabel(source, onProgress) {
  const worker = await withStage('loading the OCR engine', () => getOcrWorker(onProgress));
  const { data } = await withStage('reading the label', () => worker.recognize(source));
  return data.text || '';
}
