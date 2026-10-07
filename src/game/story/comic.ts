// The comic-book prologue of CazaPira: three pages of framed panels built from loose pieces of both games (Piracálculos backdrops and
// characters, Cazaproblemas sprites and props), with captions and speech balloons. Panels pop in one click at a time.
// Balloon coordinates are relative to their panel.
import { img } from '../core/assets';
import { roundRect, wrap } from '../core/app';
import { setFont, text } from '../ui/text';
import { skyIn, sparkle, visPortal } from '../ui/fx';
import { drawMoons } from '../scenes/title';
import { AKI } from './prologue';

export type R = { x: number; y: number; w: number; h: number };
type Paint = (g: CanvasRenderingContext2D, r: R, t: number) => void;
export interface Balloon { x: number; y: number; w: number; text: string; tail: [number, number]; shout?: boolean }
export interface ComicPanel { r: R; paint: Paint; caption?: string; cap?: 'top' | 'bottom'; balloons?: Balloon[] }
export interface ComicPage { title: string; panels: ComicPanel[] }

const PI = 'pira/images/characters/Pi/';
const FLO = 'pira/images/characters/Flo/';
const CZ = 'caza/objects/';
const OLI = 'pira/images/characters/Olivera/Olivera_A01.png';
const AKI_S = `${CZ}pc/images/pc_default_default_s001.png`;
const AKI_N = `${CZ}pc/images/pc_default_default_n001.png`;
const FOUNTAIN = `${CZ}obj_011_fountain/images/obj_011_fountain_default.png`;

/** Everything the pages draw, so the scene can preload it. */
export const COMIC_ASSETS: { plain: string[]; keyed: string[] } = {
  plain: [
    'caza/screens/intro/img_background.png', 'caza/screens/inventory/items/img_catapult.png', AKI_S, AKI_N, FOUNTAIN,
    'pira/images/level1/Fondos/Fondo_01.jpg', 'pira/images/level2/Fondos/Fondo_01.jpg', 'pira/images/level3/Fondos/Fondo_01.jpg',
  ],
  keyed: [
    `${PI}PiConLoro00.png`, `${PI}PiEspera01.png`, `${PI}Pi_00.png`, `${FLO}Loro_01.png`, `${FLO}Loro_02.png`, OLI,
    ...Array.from({ length: 3 }, (_, i) => `${PI}Pi_Salto_0${i}.png`),
    ...Array.from({ length: 8 }, (_, i) => `${PI}Pi_Caminar_0${i}.png`),
  ],
};

const dim = (im: CanvasImageSource): [number, number] => {
  const a = im as HTMLImageElement & HTMLCanvasElement;
  return [a.naturalWidth || a.width, a.naturalHeight || a.height];
};
const two = (n: number): string => String(n).padStart(2, '0');

function cover(g: CanvasRenderingContext2D, path: string, r: R, dx = 0.5, dy = 0.5): void {
  const im = img(path);
  if (!im) return;
  const [iw, ih] = dim(im), k = Math.max(r.w / iw, r.h / ih);
  g.drawImage(im, r.x - (iw * k - r.w) * dx, r.y - (ih * k - r.h) * dy, iw * k, ih * k);
}
function contain(g: CanvasRenderingContext2D, path: string, r: R): void {
  const im = img(path);
  if (!im) return;
  const [iw, ih] = dim(im), k = Math.min(r.w / iw, r.h / ih);
  g.drawImage(im, r.x + (r.w - iw * k) / 2, r.y + (r.h - ih * k) / 2, iw * k, ih * k);
}
/** Sprite standing on `base` (bottom center) with the given height; keeps the aspect ratio. */
function spr(g: CanvasRenderingContext2D, path: string, keyed: boolean, cx: number, base: number, h: number, flip = false, rot = 0, alpha = 1): void {
  const im = img(path, keyed);
  if (!im) return;
  const [iw, ih] = dim(im), k = h / ih;
  g.save(); g.globalAlpha = alpha; g.translate(cx, base - h / 2); g.rotate(rot); g.scale(flip ? -1 : 1, 1);
  g.drawImage(im, -iw * k / 2, -h / 2, iw * k, h);
  g.restore();
}
/** Soft ground shadow under a character. */
function shadow(g: CanvasRenderingContext2D, cx: number, y: number, w: number): void {
  g.save(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, y, w / 2, w / 9, 0, 0, Math.PI * 2); g.fill(); g.restore();
}
const shade = (g: CanvasRenderingContext2D, r: R, a: number): void => { g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(r.x, r.y, r.w, r.h); };
function vignette(g: CanvasRenderingContext2D, r: R, a = 0.45): void {
  const vg = g.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.3, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = vg; g.fillRect(r.x, r.y, r.w, r.h);
}
/** Blue drops of Vis falling from the small moon. */
function visRain(g: CanvasRenderingContext2D, r: R, x0: number, y0: number, t: number): void {
  for (let i = 0; i < 14; i++) {
    const u = (t * 0.35 + i * 0.137) % 1;
    const x = x0 + Math.sin(i * 7.3) * 60 + u * 40, y = y0 + u * (r.y + r.h - y0);
    g.fillStyle = `rgba(120,200,255,${0.8 * (1 - u)})`;
    g.beginPath(); g.ellipse(x, y, 3, 7, 0, 0, Math.PI * 2); g.fill();
  }
}

/** Night courtyard of the Academy: sky, flagstones, the real fountain sprite with the Vis glow. */
export function courtyard(g: CanvasRenderingContext2D, r: R, t: number, groundY = 0.66): void {
  skyIn(g, r, t, 0.15, true, { x: 0.82, y: 0.2, s: Math.min(0.42, r.h / 900) });
  const gy = r.y + r.h * groundY;
  const gr = g.createLinearGradient(0, gy, 0, r.y + r.h); gr.addColorStop(0, '#3a3f5e'); gr.addColorStop(1, '#1a1d30');
  g.fillStyle = gr; g.fillRect(r.x, gy, r.w, r.y + r.h - gy);
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2;
  for (let k = 1; k < 5; k++) { const y = gy + (r.y + r.h - gy) * (k / 5) ** 1.4; g.beginPath(); g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); g.stroke(); }
  const fx = r.x + r.w * 0.5;
  const glow = g.createRadialGradient(fx, gy, 10, fx, gy, r.h * 0.7);
  glow.addColorStop(0, 'rgba(120,200,255,0.35)'); glow.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = glow; g.fillRect(r.x, r.y, r.w, r.h);
  spr(g, FOUNTAIN, false, fx, gy + r.h * 0.2, r.h * 0.42);
}

// ------------------------------------------------------------------ pages
export const COMIC_PAGES: ComicPage[] = [
  {
    title: 'PRÓLOGO I: DOS LUNAS',
    panels: [
      {
        r: { x: 40, y: 84, w: 720, h: 400 }, cap: 'bottom',
        paint: (g, r, t) => { skyIn(g, r, t, 0.12, false); drawMoons(g, r.x + r.w * 0.36, r.y + 120, 0.62, true); visRain(g, r, r.x + r.w * 0.36 + 186 - 50, r.y + 170, t); vignette(g, r, 0.35); },
        caption: 'Terragrifus tiene dos lunas: Serélia, blanca y grande, y Syrëlia, azul y pequeña. De Syrëlia cae el Vis, la sustancia que mueve todas las máquinas del mundo.',
      },
      {
        r: { x: 784, y: 84, w: 376, h: 400 }, cap: 'top',
        paint: (g, r, t) => {
          g.fillStyle = '#120d1c'; g.fillRect(r.x, r.y, r.w, r.h);
          const rg = g.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.72, 10, r.x + r.w / 2, r.y + r.h * 0.72, 240);
          rg.addColorStop(0, 'rgba(230,180,90,0.45)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rg; g.fillRect(r.x, r.y, r.w, r.h);
          g.save(); g.setLineDash([6, 9]); g.lineDashOffset = -t * 30; g.strokeStyle = 'rgba(255,220,140,0.7)'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(r.x + 110, r.y + r.h - 130); g.quadraticCurveTo(r.x + r.w * 0.6, r.y + 150, r.x + r.w - 20, r.y + 190); g.stroke(); g.restore();
          contain(g, 'caza/screens/inventory/items/img_catapult.png', { x: r.x + 10, y: r.y + r.h - 190, w: r.w - 20, h: 180 });
        },
        caption: 'Gladius, Príncipe Cazador, construyó una catapulta para esconder la luna azul y proteger el Vis. Para todos, falló. Lo exiliaron.',
      },
      {
        r: { x: 40, y: 508, w: 1120, h: 338 }, cap: 'top',
        paint: (g, r, t) => {
          cover(g, 'pira/images/level3/Fondos/Fondo_01.jpg', r, 0.5, 0.25);
          shade(g, r, 0.18);
          spr(g, OLI, true, r.x + r.w - 330, r.y + r.h + 6 + Math.sin(t * 2) * 3, 290);
          vignette(g, r, 0.4);
        },
        caption: 'Pero el Vis no se perdió: se derramó sobre el Mar de los Números, donde manda Olivera, un pirata codicioso y hambriento de Vis.',
        balloons: [{ x: 360, y: 110, w: 280, text: '¡Todo el Vis será mío!', tail: [690, 190], shout: true }],
      },
    ],
  },
  {
    title: 'PRÓLOGO II: DOS DESTINOS',
    panels: [
      {
        r: { x: 40, y: 84, w: 540, h: 400 }, cap: 'top',
        paint: (g, r, t) => {
          g.fillStyle = '#2a1c14'; g.fillRect(r.x, r.y, r.w, r.h);
          const lg = g.createRadialGradient(r.x + r.w * 0.4, r.y + r.h * 0.6, 20, r.x + r.w * 0.4, r.y + r.h * 0.6, 340);
          lg.addColorStop(0, 'rgba(255,200,120,0.35)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = lg; g.fillRect(r.x, r.y, r.w, r.h);
          contain(g, 'caza/screens/intro/img_background.png', { x: r.x + 10, y: r.y + 130, w: r.w * 0.64, h: r.h - 136 });
          shadow(g, r.x + r.w - 96, r.y + r.h - 18, 100);
          spr(g, AKI_S, false, r.x + r.w - 96, r.y + r.h - 16 + Math.sin(t * 2) * 1.5, 190);
        },
        caption: `${AKI}, hijo de Gladius, recibe una carta de su maestro Quimerius: «Ven a la Academia de Cazaproblemas». Quiere graduarse como su padre... y saber qué le pasó.`,
      },
      {
        r: { x: 604, y: 84, w: 556, h: 400 }, cap: 'top',
        paint: (g, r, t) => {
          cover(g, 'pira/images/level3/Fondos/Fondo_01.jpg', r, 0.3, 0.45);
          shadow(g, r.x + r.w * 0.68, r.y + r.h - 14, 150);
          spr(g, `${PI}PiConLoro00.png`, true, r.x + r.w * 0.68, r.y + r.h - 4 + Math.sin(t * 2) * 2, 290);
          spr(g, `${FLO}Loro_0${1 + (Math.floor(t * 7) % 2)}.png`, true, r.x + r.w * 0.4, r.y + 250 + Math.sin(t * 5) * 6, 80, true);
          vignette(g, r, 0.3);
        },
        caption: 'En el mar, Gladius crió a Pi, el capitán de la Cólera Escarlata. Un día desapareció y le dejó una carta y un mapa en clave de números.',
        balloons: [{ x: 20, y: 120, w: 220, text: '¡Squawk! ¡Barco a la vista, capitán!', tail: [200, 220] }],
      },
      {
        r: { x: 40, y: 508, w: 1120, h: 338 }, cap: 'top',
        paint: (g, r, t) => {
          cover(g, 'pira/images/level1/Fondos/Fondo_01.jpg', r, 0.5, 0.65);
          shade(g, r, 0.3);
          spr(g, `${PI}PiEspera01.png`, true, r.x + 320, r.y + r.h - 2, 250);
          g.fillStyle = 'rgba(26,18,12,0.95)';
          for (let k = 0; k < 8; k++) g.fillRect(r.x + 170 + k * 44, r.y + 96, 10, r.h - 96);
          g.fillRect(r.x + 160, r.y + 96, 360, 12); g.fillRect(r.x + 160, r.y + r.h - 60, 360, 10);
          spr(g, OLI, true, r.x + r.w - 300, r.y + r.h + 10 + Math.sin(t * 2) * 3, 300);
          vignette(g, r, 0.45);
        },
        caption: 'Olivera lo captura, le roba el mapa (que lleva al último Vis) y lo encierra en su calabozo...',
        balloons: [{ x: 540, y: 100, w: 260, text: 'Ja, ja. Este mapa me llevará al Vis.', tail: [760, 190] }],
      },
    ],
  },
  {
    title: 'PRÓLOGO III: EL PORTAL',
    panels: [
      {
        r: { x: 40, y: 84, w: 400, h: 400 }, cap: 'top',
        paint: (g, r, t) => {
          cover(g, 'pira/images/level2/Fondos/Fondo_01.jpg', r, 0.5, 0.5);
          visPortal(g, r.x + r.w + 10, r.y + r.h * 0.64, 90, t, { digits: false, alpha: 0.85 });
          const f = Math.floor(t * 11) % 8;
          shadow(g, r.x + 160, r.y + r.h - 14, 110);
          spr(g, `${PI}Pi_Caminar_${two(f)}.png`, true, r.x + 160, r.y + r.h - 6, 220, true);
          spr(g, `${FLO}Loro_0${1 + (Math.floor(t * 6) % 2)}.png`, true, r.x + 290, r.y + 230 + Math.sin(t * 5) * 6, 86, true);
          vignette(g, r, 0.35);
        },
        caption: 'Flo libera a Pi con la llave robada. Escapan por la cueva... y al fondo brilla algo azul.',
      },
      {
        r: { x: 464, y: 84, w: 696, h: 400 }, cap: 'top',
        paint: (g, r, t) => {
          const bg = g.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.6, 20, r.x + r.w / 2, r.y + r.h * 0.6, r.w * 0.7);
          bg.addColorStop(0, '#1a2a6a'); bg.addColorStop(1, '#060818');
          g.fillStyle = bg; g.fillRect(r.x, r.y, r.w, r.h);
          for (let i = 0; i < 30; i++) sparkle(g, r.x + ((i * 97) % r.w), r.y + ((i * 53) % r.h), 1.5, 0.3 + 0.3 * Math.sin(t * 2 + i));
          const cx = r.x + r.w / 2, cy = r.y + r.h * 0.62;
          visPortal(g, cx, cy, 120, t);
          const u = (t * 0.4) % 1, e = u * u;
          spr(g, `${PI}Pi_Salto_0${u < 0.25 ? 1 : 2}.png`, true, cx - 230 * (1 - e), cy + 110 * (1 - e) - 60 * Math.sin(u * Math.PI), 240 * (1 - e * 0.85), true, e * 5, 1 - e * 0.9);
        },
        caption: 'Un portal de Vis, abierto por el eclipse. Pi salta... y el mar entero se pliega sobre otra tierra.',
        balloons: [{ x: 486, y: 130, w: 170, text: '¡AAAAH!', tail: [400, 230], shout: true }],
      },
      {
        r: { x: 40, y: 508, w: 1120, h: 338 }, cap: 'bottom',
        paint: (g, r, t) => {
          courtyard(g, r, t, 0.62);
          const cx = r.x + r.w * 0.5;
          visPortal(g, cx, r.y + 64, 44, t, { digits: false });
          const u = Math.min(1, ((t * 0.35) % 1.25)), e = 1 - (1 - u) * (1 - u);
          const sc = 0.2 + 0.8 * e;
          spr(g, `${PI}Pi_Salto_0${u < 0.6 ? 1 : 0}.png`, true, cx + 160 * e, r.y + 64 + 50 * sc + e * (r.h * 0.5), 160 * sc, u < 0.95, (1 - e) * -2.5, Math.min(1, u * 4));   // lands looking at Aki
          spr(g, `${FLO}Loro_0${1 + (Math.floor(t * 8) % 2)}.png`, true, cx + 240 * e, r.y + 50 + 30 * sc + e * 60, 70 * sc, true, 0, Math.min(1, u * 4));
          shadow(g, r.x + 230, r.y + r.h - 74, 80);
          spr(g, AKI_N, false, r.x + 230, r.y + r.h - 72, 150);
          vignette(g, r, 0.35);
        },
        caption: `Esa noche el portal se abre sobre la Fuente de la Academia, donde ${AKI}, que no podía dormir, miraba las lunas.`,
        balloons: [{ x: 270, y: 30, w: 220, text: '¿Q... qué es eso?', tail: [235, 140] }],
      },
    ],
  },
];

// ------------------------------------------------------------------ drawing helpers used by the scene
/** Drop shadow behind a panel (drawn before the art). */
export function panelShadow(g: CanvasRenderingContext2D, r: R): void {
  g.save();
  g.shadowColor = 'rgba(60,30,5,0.45)'; g.shadowBlur = 14; g.shadowOffsetX = 5; g.shadowOffsetY = 8;
  roundRect(g, r.x, r.y, r.w, r.h, 6); g.fillStyle = '#1a120c'; g.fill();
  g.restore();
}
/** White gutter line + ink border (drawn after the art). */
export function panelBorder(g: CanvasRenderingContext2D, r: R): void {
  g.save();
  roundRect(g, r.x, r.y, r.w, r.h, 6); g.lineWidth = 8; g.strokeStyle = '#fffaf0'; g.stroke();
  roundRect(g, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 9); g.lineWidth = 3.5; g.strokeStyle = '#1a120c'; g.stroke();
  g.restore();
}

export function drawCaption(g: CanvasRenderingContext2D, r: R, s: string, pos: 'top' | 'bottom' = 'top'): void {
  setFont(g, 23, 700);
  const lines = wrap(g, s, r.w - 80);
  const bw = Math.min(r.w - 24, Math.max(...lines.map((l) => g.measureText(l).width)) + 44), bh = lines.length * 29 + 20;
  const x = r.x + 12, y = pos === 'top' ? r.y + 12 : r.y + r.h - bh - 12;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  g.fillStyle = '#fff1c4'; g.fillRect(x, y, bw, bh);
  g.shadowColor = 'transparent';
  g.fillStyle = '#c8202c'; g.fillRect(x, y, 8, bh);
  g.lineWidth = 2.5; g.strokeStyle = '#2a1a10'; g.strokeRect(x, y, bw, bh);
  lines.forEach((l, i) => text(g, l, x + 22, y + 30 + i * 29, { size: 23, weight: 700, color: '#2a1a10' }));
  g.restore();
}

export function drawBalloon(g: CanvasRenderingContext2D, r: R, b: Balloon): void {
  const bx = r.x + b.x, by = r.y + b.y, tx = r.x + b.tail[0], ty = r.y + b.tail[1];
  setFont(g, 24, b.shout ? 800 : 600);
  const lines = wrap(g, b.text, b.w - 40);
  const h = lines.length * 29 + 26;
  const cx = bx + b.w / 2, cy = by + h / 2;
  g.save();
  g.lineWidth = 3.5; g.strokeStyle = '#1a1210'; g.fillStyle = '#fffdf4';
  // tail first so the body covers its base
  const ang = Math.atan2(ty - cy, tx - cx);
  const ex = cx + Math.cos(ang) * (b.w / 2) * 0.7, ey = cy + Math.sin(ang) * (h / 2) * 0.7;
  const nx = -Math.sin(ang) * 14, ny = Math.cos(ang) * 14;
  const tail = new Path2D();
  tail.moveTo(ex + nx, ey + ny);
  tail.quadraticCurveTo((ex + tx) / 2 + nx * 0.3, (ey + ty) / 2 + ny * 0.3, tx, ty);
  tail.quadraticCurveTo((ex + tx) / 2 - nx * 0.1, (ey + ty) / 2 - ny * 0.1, ex - nx, ey - ny);
  tail.closePath();
  g.fill(tail); g.stroke(tail);
  g.beginPath();
  if (b.shout) {
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, k = i % 2 ? 1 : 1.18;
      const x = cx + Math.cos(a) * (b.w / 2 + 8) * k, y = cy + Math.sin(a) * (h / 2 + 8) * k;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  } else {
    g.ellipse(cx, cy, b.w / 2 + 8, h / 2 + 8, 0, 0, Math.PI * 2);
  }
  g.fill(); g.stroke();
  // erase the body outline where the tail joins it
  const inner = new Path2D();
  inner.moveTo(ex + nx * 0.7, ey + ny * 0.7); inner.lineTo(ex + (tx - ex) * 0.5, ey + (ty - ey) * 0.5); inner.lineTo(ex - nx * 0.7, ey - ny * 0.7); inner.closePath();
  g.fill(inner);
  lines.forEach((l, i) => text(g, l, cx, by + 33 + i * 29, { size: 24, weight: b.shout ? 800 : 600, color: '#1a1210', align: 'center' }));
  g.restore();
}
