// Shared visual effects: the Vis portal (used by the comic, the meeting and the Ecos in the world), an undistorted night sky
// for any rectangle, comic halftone paper and small easing helpers.
import { W, H } from '../core/app';
import { drawMoons, drawSky } from '../scenes/title';
import { pixText } from './pixfont';

export const easeOutBack = (x: number): number => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** The full-screen night sky fitted into a rectangle with a UNIFORM scale (cover), so the moons stay round. */
export function skyIn(g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, t: number, anchorY = 0.5, moons = true,
  moon?: { x: number; y: number; s: number }): void {
  const k = Math.max(r.w / W, r.h / H);
  g.save();
  g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
  g.save();
  g.translate(r.x + (r.w - W * k) / 2, r.y + (r.h - H * k) * anchorY);
  g.scale(k, k);
  drawSky(g, t, moons && !moon);
  g.restore();
  // explicit moon placement (panel coordinates) keeps them small in wide panels
  if (moons && moon) drawMoons(g, r.x + moon.x * r.w, r.y + moon.y * r.h, moon.s);
  g.restore();
}

export interface PortalOpts {
  /** vertical squash for the top-down world (1 = round) */
  squash?: number;
  /** base hue: 205 blue (open), 135 green (closed Eco), -1 grey (sealed) */
  hue?: number;
  digits?: boolean;
  alpha?: number;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '+', '×'];

/** A swirling Vis portal: halo, dark core, three spiral arms, a bright rim and numbers of the sea orbiting around it. */
export function visPortal(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number, o: PortalOpts = {}): void {
  const sq = o.squash ?? 1, hue = o.hue ?? 205, grey = hue < 0;
  const col = (l: number, a: number, dh = 0): string => grey ? `hsla(220,8%,${l}%,${a})` : `hsla(${hue + dh},90%,${l}%,${a})`;
  g.save();
  g.globalAlpha = o.alpha ?? 1;
  g.translate(cx, cy);
  // halo (drawn round, then squashed with the rest so the whole portal shares one perspective)
  g.scale(1, sq);
  const halo = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.75);
  halo.addColorStop(0, col(70, 0.55)); halo.addColorStop(0.55, col(55, 0.22)); halo.addColorStop(1, col(50, 0));
  g.fillStyle = halo; g.beginPath(); g.arc(0, 0, R * 1.75, 0, Math.PI * 2); g.fill();
  // core
  const core = g.createRadialGradient(0, 0, 0, 0, 0, R);
  core.addColorStop(0, grey ? '#2a2c33' : '#050a26'); core.addColorStop(0.55, col(28, 1, 20)); core.addColorStop(0.92, col(55, 1)); core.addColorStop(1, col(80, 1));
  g.fillStyle = core; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  // spiral arms
  g.save();
  g.beginPath(); g.arc(0, 0, R * 0.97, 0, Math.PI * 2); g.clip();
  g.lineCap = 'round';
  const spin = grey ? t * 0.3 : t * 1.6;
  for (let arm = 0; arm < 3; arm++) {
    const a0 = arm * (Math.PI * 2 / 3) + spin;
    let px = 0, py = 0;
    for (let i = 0; i <= 28; i++) {
      const u = i / 28;
      const rr = R * (0.08 + 0.9 * u);
      const a = a0 + (1 - u) * Math.PI * 2.2;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i > 0) {
        g.strokeStyle = col(75 + 20 * (1 - u), 0.15 + 0.6 * (1 - Math.abs(u - 0.45) * 1.6), -10);
        g.lineWidth = Math.max(1, R * 0.11 * (1 - u * 0.7));
        g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
      }
      px = x; py = y;
    }
  }
  // bright eye
  const eye = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.32);
  eye.addColorStop(0, grey ? 'rgba(200,200,210,0.6)' : 'rgba(255,255,255,0.95)'); eye.addColorStop(1, col(70, 0));
  g.fillStyle = eye; g.beginPath(); g.arc(0, 0, R * 0.32, 0, Math.PI * 2); g.fill();
  g.restore();
  // rim with a travelling highlight
  g.lineWidth = Math.max(2, R * 0.07);
  g.strokeStyle = col(85, 0.95); g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
  g.lineWidth = Math.max(1.5, R * 0.05);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  const h0 = t * 2.4;
  g.beginPath(); g.arc(0, 0, R, h0, h0 + 0.9); g.stroke();
  g.beginPath(); g.arc(0, 0, R, h0 + Math.PI, h0 + Math.PI + 0.6); g.stroke();
  g.restore();
  // orbiting numbers of the Sea of Numbers and sparkles (kept upright, positioned on the squashed orbit)
  if (o.digits !== false && !grey) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = t * 0.6 + (i / n) * Math.PI * 2;
      const rr = R * (1.22 + 0.06 * Math.sin(t * 2 + i));
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * sq;
      const size = Math.max(9, R * 0.24);
      g.globalAlpha = (o.alpha ?? 1) * (0.55 + 0.45 * Math.sin(t * 3 + i * 1.7));
      if (!pixText(g, DIGITS[(i + Math.floor(t * 0.5)) % DIGITS.length], x, y + size / 2, { size, color: '#e8f6ff', align: 'center', outline: col(35, 1) })) {
        g.fillStyle = '#e8f6ff'; g.font = `800 ${size}px CPFutura, sans-serif`; g.textAlign = 'center'; g.fillText(DIGITS[i], x, y + size / 2);
      }
    }
    for (let i = 0; i < 6; i++) {
      const a = -t * 0.9 + i * 1.3;
      const rr = R * (0.9 + 0.5 * ((i * 0.37 + t * 0.25) % 1));
      sparkle(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sq, Math.max(2, R * 0.07) * (0.6 + 0.4 * Math.sin(t * 5 + i)), (o.alpha ?? 1) * 0.9);
    }
    g.globalAlpha = 1;
  }
}

export function sparkle(g: CanvasRenderingContext2D, x: number, y: number, s: number, a = 1): void {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(x, y - s * 2); g.quadraticCurveTo(x, y, x + s * 2, y); g.quadraticCurveTo(x, y, x, y + s * 2); g.quadraticCurveTo(x, y, x - s * 2, y); g.quadraticCurveTo(x, y, x, y - s * 2);
  g.fill();
  g.restore();
}

let halftone: CanvasPattern | null = null;
/** Warm comic paper with a faint halftone dot screen. */
export function comicPaper(g: CanvasRenderingContext2D): void {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#f7e9bd'); gr.addColorStop(1, '#efd99c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (!halftone) {
    const c = document.createElement('canvas'); c.width = 12; c.height = 12;
    const x = c.getContext('2d')!;
    x.fillStyle = 'rgba(160,90,30,0.13)'; x.beginPath(); x.arc(3, 3, 1.6, 0, 7); x.fill(); x.beginPath(); x.arc(9, 9, 1.6, 0, 7); x.fill();
    halftone = g.createPattern(c, 'repeat');
  }
  if (halftone) { g.fillStyle = halftone; g.fillRect(0, 0, W, H); }
  const vg = g.createRadialGradient(W / 2, H / 2, 320, W / 2, H / 2, 860);
  vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(110,60,15,0.32)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

/** Red Cazaproblemas ribbon with gold trim and a title in the Piracálculos font. */
export function ribbon(g: CanvasRenderingContext2D, cx: number, y: number, w: number, label: string, size = 26): void {
  const h = size + 22;
  g.save();
  g.fillStyle = '#8a1018';
  g.beginPath(); g.moveTo(cx - w / 2 - 34, y + 8); g.lineTo(cx - w / 2 + 6, y + 8); g.lineTo(cx - w / 2 + 6, y + h + 8); g.lineTo(cx - w / 2 - 34, y + h + 8); g.lineTo(cx - w / 2 - 20, y + h / 2 + 8); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx + w / 2 + 34, y + 8); g.lineTo(cx + w / 2 - 6, y + 8); g.lineTo(cx + w / 2 - 6, y + h + 8); g.lineTo(cx + w / 2 + 34, y + h + 8); g.lineTo(cx + w / 2 + 20, y + h / 2 + 8); g.closePath(); g.fill();
  g.fillStyle = '#c8202c'; g.fillRect(cx - w / 2, y, w, h);
  g.fillStyle = '#ffc20e'; g.fillRect(cx - w / 2, y + 3, w, 3); g.fillRect(cx - w / 2, y + h - 6, w, 3);
  g.restore();
  if (!pixText(g, label, cx, y + h / 2 + size / 2 - 1, { size, color: '#fff3c0', align: 'center', outline: '#5a0a10' })) {
    g.fillStyle = '#fff3c0'; g.font = `800 ${size}px CPFutura, sans-serif`; g.textAlign = 'center'; g.fillText(label, cx, y + h / 2 + size / 2 - 2);
  }
}
