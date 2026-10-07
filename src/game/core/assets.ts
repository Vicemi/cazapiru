// Asset access: images (cached, color-keyed on demand), JSON, binary. Everything lives under /assets/ (see tools/build_*.py).

const images = new Map<string, HTMLImageElement | HTMLCanvasElement | null>();
const pending = new Map<string, Promise<void>>();

export const BASE = '/assets/';

function loadImage(path: string, key: boolean): Promise<void> {
  const id = (key ? 'k:' : '') + path;
  let p = pending.get(id);
  if (p) return p;
  p = new Promise<void>((resolve) => {
    const im = new Image();
    im.onload = () => {
      images.set(id, key ? colorKey(im) : im);
      resolve();
    };
    im.onerror = () => { images.set(id, null); resolve(); };
    im.src = BASE + path;
  });
  pending.set(id, p);
  return p;
}

/** Magenta (255,0,255) is transparent: the color key SDL used for the Piracalculos sprites. */
function colorKey(im: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) if (px[i] > 250 && px[i + 1] < 6 && px[i + 2] > 250) px[i + 3] = 0;
  g.putImageData(d, 0, 0);
  return c;
}

export function preload(paths: string[], key = false): Promise<void[]> {
  return Promise.all(paths.map((p) => loadImage(p, key)));
}

/** Optional filter for color-keyed images (used to recolor Pi with the chosen skin everywhere). */
let keyedHook: ((path: string, im: CanvasImageSource) => CanvasImageSource) | null = null;
export function setKeyedHook(f: typeof keyedHook): void { keyedHook = f; }

/** Cached image or null while it is still loading (a load is started). Keyed images go through the keyed hook. */
export function img(path: string, key = false): CanvasImageSource | null {
  const v = imgRaw(path, key);
  return v && key && keyedHook ? keyedHook(path, v) : v;
}

/** The image exactly as loaded (no hook). */
export function imgRaw(path: string, key = false): CanvasImageSource | null {
  const id = (key ? 'k:' : '') + path;
  const v = images.get(id);
  if (v === undefined) { void loadImage(path, key); return null; }
  return v;
}

export async function json<T = unknown>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error('missing ' + path);
  return r.json() as Promise<T>;
}

export async function bytes(path: string): Promise<Uint8Array | null> {
  const r = await fetch(BASE + path);
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
}

export async function arrayBuffer(path: string): Promise<ArrayBuffer | null> {
  const r = await fetch(BASE + path);
  return r.ok ? r.arrayBuffer() : null;
}
