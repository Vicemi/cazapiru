// Dialog box of Cazaproblemas (data/dialogs/images/background.png + next arrow) with typewriter text, speaker colours and choices.
import { img } from '../core/assets';
import { isPressed, pointer } from '../core/input';
import { playSound } from '../core/audio';
import { setFont, text as drawText } from './text';
import { wrap } from '../core/app';

const SPEAKERS: Record<string, string> = {
  Aki: '#ff8a4a', Pi: '#5fd08a', Flo: '#9be15a', Lis: '#ff8fc8', Luceria: '#f5d36a', Quimerius: '#8fd0ff', 'Máximus': '#ff6a6a', Maximus: '#ff6a6a',
  Jocosius: '#ffb347', Farsantius: '#ff7a5a', Aurelia: '#7fe3d0', Armandius: '#c9b27a', Olivera: '#ff5a5a', Gladius: '#ffd24a', Alumno: '#cfd8ff',
  'E. Rojo': '#ff7070', 'E. Azul': '#7aa8ff', 'E. Amarillo': '#ffe066', 'E. Verde': '#7fe07f', Entrenador: '#e0e0ff', 'E. Laboratorio': '#d0b0ff',
};

interface Pending { text: string; resolve: () => void }
interface Choice { q: string; opts: string[]; resolve: (i: number) => void; sel: number }

export class DialogUI {
  private cur: Pending | null = null;
  private queue: Pending[] = [];
  private shown = 0;
  private choice: Choice | null = null;
  private t = 0;
  /** applied to every line: lets the game rename the hero (Aki -> Pi) */
  subst: (s: string) => string = (s) => s;

  /** speaker of the line on screen ('' for narration) */
  get speaker(): string {
    const s = this.cur?.text ?? this.choice?.q ?? '';
    const m = /^\[([^\]]+)\]/.exec(s);
    return m ? m[1].replace(/​/g, '') : '';
  }

  get active(): boolean { return !!this.cur || !!this.choice || this.queue.length > 0; }

  say(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ text: this.subst(text), resolve });
      if (!this.cur) this.next();
    });
  }

  choose(question: string, options: string[]): Promise<number> {
    return new Promise((resolve) => {
      this.choice = { q: this.subst(question), opts: options.map((o) => this.subst(o)), resolve, sel: 0 };
    });
  }

  private next(): void {
    this.cur = this.queue.shift() ?? null;
    this.shown = 0;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.choice) {
      const c = this.choice;
      if (isPressed('up')) c.sel = (c.sel + c.opts.length - 1) % c.opts.length;
      if (isPressed('down')) c.sel = (c.sel + 1) % c.opts.length;
      const rects = this.choiceRects(c);
      if (pointer.inside) rects.forEach((r, i) => { if (pointer.y >= r.y && pointer.y < r.y + r.h && pointer.x >= r.x && pointer.x < r.x + r.w) { if (c.sel !== i) c.sel = i; if (pointer.pressed) { this.pick(c); } } });
      if (isPressed('act')) this.pick(c);
      return;
    }
    const d = this.cur;
    if (!d) return;
    this.shown = Math.min(d.text.length, this.shown + dt * 55);
    if (isPressed('act') || pointer.pressed) {
      if (this.shown < d.text.length) this.shown = d.text.length;
      else {
        playSound('caza/sounds/general/btn_press.ogg', 0.4);
        const r = d.resolve;
        this.cur = null;
        this.next();
        r();
      }
    }
  }

  private pick(c: Choice): void {
    this.choice = null;
    playSound('caza/sounds/general/btn_press.ogg', 0.5);
    c.resolve(c.sel);
  }

  private choiceRects(c: Choice): { x: number; y: number; w: number; h: number }[] {
    const base = 470 - c.opts.length * 66;
    return c.opts.map((_, i) => ({ x: 700, y: base + i * 66, w: 440, h: 56 }));
  }

  render(g: CanvasRenderingContext2D): void {
    if (!this.active) return;
    const bg = img('caza/dialogs/images/background.png');
    const c = this.choice;
    if (bg) g.drawImage(bg, 8, 524, 1182, 416);
    else { g.fillStyle = 'rgba(8,10,16,0.92)'; g.fillRect(8, 524, 1182, 330); }
    if (c) {
      this.renderText(g, c.q, 60, 590);
      const rects = this.choiceRects(c);
      c.opts.forEach((o, i) => {
        const r = rects[i];
        g.fillStyle = c.sel === i ? 'rgba(190,220,80,0.95)' : 'rgba(20,24,34,0.95)';
        g.fillRect(r.x, r.y, r.w, r.h);
        g.strokeStyle = '#b8d04a'; g.lineWidth = 3; g.strokeRect(r.x, r.y, r.w, r.h);
        drawText(g, o, r.x + 16, r.y + r.h / 2, { size: 30, baseline: 'middle', color: c.sel === i ? '#10140a' : '#e8f0b8' });
      });
      return;
    }
    const d = this.cur;
    if (!d) return;
    this.renderText(g, d.text.slice(0, Math.floor(this.shown)), 60, 590, d.text);
    if (this.shown >= d.text.length) {
      const nx = img('caza/dialogs/images/next.png');
      const bob = Math.sin(this.t * 6) * 4;
      if (nx) g.drawImage(nx, 1060, 768 + bob, 68, 68);
    }
  }

  private renderText(g: CanvasRenderingContext2D, s: string, x: number, y: number, full?: string): void {
    const src = full ?? s;
    const m = /^\[([^\]]+)\]\s*/.exec(src);
    let name = '';
    let body = s;
    if (m) { name = m[1].replace(/​/g, ''); body = s.slice(Math.min(m[0].length, s.length)); }
    setFont(g, 38, 500);
    const maxW = 1058;
    let ly = y;
    if (name) { drawText(g, name, x, ly, { size: 40, weight: 800, color: SPEAKERS[name.replace(/^Consola: /, '').replace(/^A través de la Consola: /, '')] ?? '#ffe9a8', outline: '#000', outlineW: 6 }); ly += 56; }
    // wrap against the full text so words do not jump while typing
    const fullBody = m ? src.slice(m[0].length) : src;
    setFont(g, 38, 500);
    const lines = wrap(g, fullBody, maxW);
    let used = 0;
    for (const l of lines) {
      const vis = body.slice(used, used + l.length);
      if (vis) drawText(g, vis, x, ly, { size: 38, weight: 500, color: '#f0f4e0', outline: '#000', outlineW: 5 });
      used += l.length + 1;
      ly += 54;
    }
  }
}
