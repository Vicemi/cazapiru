// Outfits for both heroes. Aki keeps the original Cazaproblemas outfits (separate sprite sets); Pi gets "skins" made by
// recoloring his own Piracálculos frames: every pixel is classified by color (hair, coat, hat, pants; skin and outlines are
// never touched) and moved to a new hue / saturation / lightness. Skins unlock as the Ecos get closed.
import { img, imgRaw, setKeyedHook } from '../core/assets';
import { save } from '../save';

interface Tone { h?: number; s?: number; l?: number }
/** `id` is the outfit item of the original game: Aki wears its sprite set, Pi a recolor of his frames. */
export interface Skin { id: string; label: string; piLabel: string; hair?: Tone; coat?: Tone; hat?: Tone; pants?: Tone; shadow?: boolean }

/** The four outfits of Los Cazaproblemas, in their original order, with Pi's matching look. */
export const OUTFITS: Skin[] = [
  { id: 'default', label: 'Uniforme', piLabel: 'Clásico' },
  { id: 'cold', label: 'Abrigo', piLabel: 'Abrigo', coat: { h: 186, s: 0.75, l: 0.04 }, hat: { h: 190, s: 1.6, l: 0.06 }, pants: { h: 220, s: 0.35, l: -0.18 } },
  { id: 'brad', label: 'Brad', piLabel: 'Brad', hair: { h: 48, s: 1.5, l: 0.26 }, coat: { h: 330, s: 1.7, l: 0.12 }, pants: { h: 330, s: 1, l: -0.06 } },
  { id: 'shadow', label: 'Sombra', piLabel: 'Sombra', shadow: true },
];

/** Is the outfit owned? The uniform always is; the others are items bought in the story (add_item), shared by both heroes. */
export const outfitOwned = (id: string): boolean => id === 'default' || save().items.includes(id);

/** The outfit both heroes wear: the selected one if it is owned, otherwise the original. */
export function currentOutfit(): string {
  const o = save().outfit || 'default';
  return OUTFITS.some((k) => k.id === o) && outfitOwned(o) ? o : 'default';
}

export function piSkin(): Skin {
  const id = currentOutfit();
  return OUTFITS.find((k) => k.id === id) ?? OUTFITS[0];
}

// ------------------------------------------------------------------ recoloring
const cache = new Map<string, HTMLCanvasElement>();

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}
function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Which part of Pi a pixel belongs to (measured on Pi_00 and the walk frames). */
function region(h: number, s: number, l: number): 'hair' | 'coat' | 'hat' | 'pants' | null {
  if (s < 0.08) return null;                                   // outlines, eye whites, the skull
  if (h >= 280 && h <= 352 && l < 0.55) return 'hair';          // purple hair
  if (h >= 12 && h <= 58 && l < 0.42) return 'coat';            // brown / olive coat (the orange skin is lighter)
  if (h >= 200 && h <= 265 && l < 0.4) return 'hat';            // dark navy hat
  if (h >= 150 && h < 200) return 'pants';                      // cyan pants and sash
  return null;
}

function apply(t: Tone, h: number, s: number, l: number): [number, number, number] {
  return [t.h ?? h, Math.max(0, Math.min(1, s * (t.s ?? 1))), Math.max(0, Math.min(1, l + (t.l ?? 0)))];
}

/** A keyed Pi frame recolored with the skin (cached). Falls back to the original while it loads. */
export function skinned(path: string, skin: Skin = piSkin()): CanvasImageSource | null {
  const base = imgRaw(path, true);
  if (!base || skin.id === 'default') return base;
  const key = `${skin.id}|${path}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const src = base as HTMLCanvasElement;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 8) continue;
    const [h, s, l] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
    if (skin.shadow) {
      // the Shadow outfit: a black silhouette with glowing red eyes (the light spots of the face)
      if (l > 0.85 && s < 0.2) { px[i] = 255; px[i + 1] = 70; px[i + 2] = 30; }
      else { const v = Math.round(10 + l * 30); px[i] = v; px[i + 1] = v; px[i + 2] = v + 6; }
      continue;
    }
    const part = region(h, s, l);
    const tone = part ? skin[part] : undefined;
    if (!tone) continue;
    const [nh, ns, nl] = apply(tone, h, s, l);
    const [r, gg, b] = hsl2rgb(((nh % 360) + 360) % 360, ns, nl);
    px[i] = r; px[i + 1] = gg; px[i + 2] = b;
  }
  g.putImageData(d, 0, 0);
  cache.set(key, c);
  return c;
}

// every Pi frame drawn anywhere (world, pirate levels, scenes) wears the chosen skin
setKeyedHook((path, im) => (path.includes('/characters/Pi/') ? (skinned(path) ?? im) : im));

// ------------------------------------------------------------------ the chosen hero's head (map marker, outfit cards)
/** Draws the head of the hero you play in a round badge centered at (cx, cy). */
export function drawHeroHead(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, hero = save().hero ?? 'aki', skin?: Skin): void {
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = hero === 'pi' ? '#1f5a46' : '#7a1a22'; g.fill();
  g.lineWidth = Math.max(2, r * 0.12); g.strokeStyle = '#ffe9a8'; g.stroke();
  g.clip();
  if (hero === 'pi') {
    const im = skinned('pira/images/characters/Pi/Pi_00.png', skin ?? piSkin());
    // head and hat of the 256x256 frame
    if (im) g.drawImage(im, 30, 10, 196, 150, cx - r * 1.25, cy - r * 1.05, r * 2.5, r * 1.92);
  } else {
    const outfit = currentOutfit();
    const im = img(`caza/objects/pc/images/pc_${outfit}_default_s001.png`) ?? img('caza/objects/pc/images/pc_default_default_s001.png');
    if (im) g.drawImage(im, 0, 0, 70, 60, cx - r * 1.1, cy - r * 1.05, r * 2.2, r * 1.9);
  }
  g.restore();
}
