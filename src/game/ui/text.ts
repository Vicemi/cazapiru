// Text and widget helpers. The UI font is the Futura family shipped with Cazaproblemas (loaded by index.astro as CPFutura).
import { pointer, touchHint } from '../core/input';
import { roundRect, wrap } from '../core/app';

export const FONT = 'CPFutura, "Futura", "Trebuchet MS", system-ui, sans-serif';

export interface TextOpts {
  size?: number; color?: string; align?: CanvasTextAlign; weight?: number | string; outline?: string; outlineW?: number;
  shadow?: string; baseline?: CanvasTextBaseline; alpha?: number; italic?: boolean;
}

export function setFont(g: CanvasRenderingContext2D, size: number, weight: number | string = 400, italic = false): void {
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: TextOpts = {}): void {
  s = touchHint(s);
  setFont(g, o.size ?? 28, o.weight ?? 400, o.italic);
  g.textAlign = o.align ?? 'left';
  g.textBaseline = o.baseline ?? 'alphabetic';
  if (o.alpha !== undefined) g.globalAlpha = o.alpha;
  if (o.outline) { g.lineJoin = 'round'; g.lineWidth = o.outlineW ?? Math.max(3, (o.size ?? 28) / 6); g.strokeStyle = o.outline; g.strokeText(s, x, y); }
  if (o.shadow) { g.fillStyle = o.shadow; g.fillText(s, x + 2, y + 2); }
  g.fillStyle = o.color ?? '#fff';
  g.fillText(s, x, y);
  if (o.alpha !== undefined) g.globalAlpha = 1;
}

/** Wrapped paragraph; returns the y after the last line. */
export function paragraph(g: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, lineH: number, o: TextOpts = {}): number {
  setFont(g, o.size ?? 28, o.weight ?? 400, o.italic);
  const lines = wrap(g, s, maxW);
  for (const l of lines) { text(g, l, x, y, o); y += lineH; }
  return y;
}

export interface Btn {
  x: number; y: number; w: number; h: number; label: string; id?: string; disabled?: boolean; sub?: string;
}

export function hit(b: { x: number; y: number; w: number; h: number }): boolean {
  return pointer.inside && pointer.x >= b.x && pointer.x < b.x + b.w && pointer.y >= b.y && pointer.y < b.y + b.h;
}

/** Parchment-style button used by the menus. Returns true when clicked this frame. */
export function button(g: CanvasRenderingContext2D, b: Btn, selected = false): boolean {
  const over = !b.disabled && hit(b);
  const down = over && pointer.down;
  g.save();
  g.translate(0, down ? 2 : 0);
  roundRect(g, b.x, b.y, b.w, b.h, 14);
  g.fillStyle = b.disabled ? 'rgba(60,50,40,0.55)' : selected || over ? '#ffd873' : '#f3e2b0';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = b.disabled ? '#6c5a44' : selected || over ? '#b3501d' : '#7a4a22';
  g.stroke();
  text(g, b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.sub ? -6 : 0), { size: Math.min(34, b.h * 0.5), align: 'center', baseline: 'middle', color: b.disabled ? '#a39580' : '#3a2412', weight: 700 });
  if (b.sub) text(g, b.sub, b.x + b.w / 2, b.y + b.h / 2 + 20, { size: 18, align: 'center', baseline: 'middle', color: '#6a4c2a' });
  g.restore();
  return over && pointer.clicked;
}

export function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = 'rgba(250,236,196,0.96)', stroke = '#7a4a22'): void {
  roundRect(g, x, y, w, h, 20);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = stroke;
  g.stroke();
}
