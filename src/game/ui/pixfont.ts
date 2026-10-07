// The bitmap font of Piracálculos (white Futura-style atlas, tools/build_pixfont.py -> font.json). Used for the pirate half of the
// UI (level HUD, Eco names, duel counters) so both typefaces live in the same game: Futura OTF for the Cazaproblemas side.
import { img, json, preload } from '../core/assets';
import { text } from './text';

interface Metrics { glyphs: Record<string, [number, number, number, number, number]>; baseline: number; capH: number }

const ATLAS = 'pira/lang/images/white_font_new_SDL.png';
let metrics: Metrics | null = null;
let loading: Promise<void> | null = null;
const tints = new Map<string, HTMLCanvasElement>();

export function loadPixFont(): Promise<void> {
  if (!loading) loading = (async () => {
    metrics = await json<Metrics>('pira/lang/images/font.json');
    await preload([ATLAS], true);
  })().catch(() => { /* falls back to the vector font */ });
  return loading;
}

function tinted(color: string): CanvasImageSource | null {
  const base = img(ATLAS, true);
  if (!base) return null;
  if (color === '#fff' || color === '#ffffff') return base;
  let c = tints.get(color);
  if (!c) {
    const b = base as HTMLCanvasElement;
    c = document.createElement('canvas'); c.width = b.width; c.height = b.height;
    const g = c.getContext('2d')!;
    g.drawImage(b, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    tints.set(color, c);
  }
  return c;
}

export interface PixOpts { size?: number; color?: string; align?: 'left' | 'center' | 'right'; outline?: string; spacing?: number }

/** Width of a string at `size` px cap height scaled so a capital letter is `size` px tall. */
export function pixWidth(s: string, size = 32, spacing = 2): number {
  if (!metrics) return s.length * size * 0.6;
  const k = size / metrics.capH;
  let w = 0;
  for (const ch of s) { const gl = metrics.glyphs[ch]; w += (gl ? gl[2] : metrics.capH * 0.45) * k + spacing * k; }
  return w;
}

/** Draws text with the Piracálculos bitmap font; y is the baseline. Returns false when the atlas is not ready (caller may fall back). */
export function pixText(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: PixOpts = {}): boolean {
  const size = o.size ?? 32, color = o.color ?? '#fff', sp = o.spacing ?? 2;
  if (!metrics) { void loadPixFont(); return false; }
  const front = tinted(color), back = o.outline ? tinted(o.outline) : null;
  if (!front) return false;
  const k = size / metrics.capH;
  const total = pixWidth(s, size, sp);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  for (const ch of s) {
    const gl = metrics.glyphs[ch === ' ' ? '' : ch];
    if (!gl) { cx += metrics.capH * 0.5 * k; continue; }
    const [sx, sy, sw, sh, bl] = gl;
    // bl = distance from the glyph's top to the text baseline (accents rise above, descenders hang below)
    const top = y - bl * k;
    if (back) { const d = Math.max(0.75, size / 15); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) g.drawImage(back, sx, sy, sw, sh, cx + ox * d, top + oy * d, sw * k, sh * k); }
    g.drawImage(front, sx, sy, sw, sh, cx, top, sw * k, sh * k);
    cx += sw * k + sp * k;
  }
  return true;
}

/** Piracálculos bitmap font when ready, otherwise the Futura fallback. */
export function pixOrText(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: PixOpts = {}): void {
  if (pixText(g, s, x, y, o)) return;
  text(g, s, x, y, { size: (o.size ?? 32) * 1.1, color: o.color ?? '#fff', align: o.align, weight: 800, outline: o.outline, outlineW: 6 });
}
