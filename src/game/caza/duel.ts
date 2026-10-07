// "Duelo de cálculo": the pirate creatures that fell into Terragrifus challenge Aki / Pi with quick arithmetic (dice sums,
// missing numbers, tables, sequences). Three questions, two right answers win.
import { App, W, H, roundRect, type Scene } from '../core/app';
import { img } from '../core/assets';
import { playSound } from '../core/audio';
import { isPressed, keyPressed, pointer } from '../core/input';
import { text, paragraph } from '../ui/text';
import { pixOrText } from '../ui/pixfont';
import { isEasy, save } from '../save';

/** `labels` (same order as `options`) show an expression instead of the number: Piracálculos' key/lock matching. `dice` + `missing` = a die is hidden. */
export interface DuelQ { prompt: string; dice?: number[]; missing?: boolean; options: number[]; labels?: string[]; answer: number; hint: string }
export type EnemyKind = 'dado' | 'calavera' | 'ronca' | 'sabio';

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = <T,>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((v) => v[1]);

function options(ans: number, spread: number): number[] {
  const set = new Set<number>([ans]);
  let guard = 0;
  while (set.size < 4 && guard++ < 50) {
    const d = rnd(1, spread) * (Math.random() < 0.5 ? -1 : 1);
    if (ans + d >= 1) set.add(ans + d);
  }
  return shuffle([...set]);
}

/** A random expression whose value is `v` (a product when v is composite, otherwise a sum). */
function exprFor(v: number): string {
  const f: number[] = [];
  for (let d = 2; d <= 9; d++) if (v % d === 0 && v / d >= 2 && v / d <= 12) f.push(d);
  if (f.length && Math.random() < 0.7) { const d = f[rnd(0, f.length - 1)]; return `${d} × ${v / d}`; }
  const a = rnd(1, Math.max(1, v - 1)); return `${a} + ${v - a}`;
}

export function makeQuestion(kind: EnemyKind, year: number): DuelQ {
  // the Sage of the Order asks everything: every mechanic of both games
  if (kind === 'sabio') { const ks: EnemyKind[] = ['dado', 'calavera', 'ronca']; return makeQuestion(ks[rnd(0, 2)], year); }
  const hard = year >= 6;
  // the fused rounds: one question per Piracálculos level mechanic, plus Cazaproblemas geometry
  const mix = Math.random();
  if (kind === 'calavera' && mix < 0.4) {   // level 1: bring the key to its lock
    const v = rnd(hard ? 24 : 6, hard ? 72 : 36);
    const opts = options(v, hard ? 8 : 4);
    return { prompt: `La llave del cofre dice ${v}. ¿Qué candado abre? (el candado es una cuenta)`, options: opts, labels: opts.map((o) => exprFor(o)), answer: v, hint: 'Resolvé cada candado' };
  }
  if (kind === 'dado' && mix < 0.4) {       // level 5: two dice, exact sum; one die is hidden under the cup
    const a = rnd(1, 6), b = rnd(1, 6);
    return { prompt: `El tablero pide exactamente ${a + b}. Ya salió un dado. ¿Qué número debe salir en el otro?`, dice: [a], missing: true, options: options(b, 2), answer: b, hint: `${a + b} − ${a}` };
  }
  if (kind === 'dado' && mix < 0.65) {      // level 3: stack crates up to the pier
    const c = rnd(2, hard ? 9 : 6), n = rnd(2, hard ? 9 : 6);
    return { prompt: `El muelle está a ${c * n} de altura y cada cajón mide ${c}. ¿Cuántos cajones hay que apilar?`, options: options(n, 3), answer: n, hint: `${c * n} ÷ ${c}` };
  }
  if (kind === 'ronca' && mix < 0.45) {     // Cazaproblemas geometry: perimeter / area of the pirate's chest
    const a = rnd(3, hard ? 14 : 9), b = rnd(2, hard ? 11 : 7);
    return Math.random() < 0.5
      ? { prompt: `El cofre del pirata es un rectángulo de ${a} por ${b}. ¿Cuánto mide su perímetro?`, options: options(2 * (a + b), 5), answer: 2 * (a + b), hint: `2 × (${a} + ${b})` }
      : { prompt: `La cubierta es un rectángulo de ${a} por ${b}. ¿Cuál es su área?`, options: options(a * b, 6), answer: a * b, hint: `${a} × ${b}` };
  }
  if (kind === 'calavera' && mix < 0.7) {   // Cazaproblemas logic: how many treasures remain after splitting evenly
    const n = rnd(2, 6), each = rnd(3, hard ? 15 : 9), extra = rnd(1, n - 1);
    return { prompt: `${n} piratas se reparten el botín por igual y a cada uno le tocan ${each}, pero sobran ${extra} monedas. ¿Cuántas monedas había en total?`, options: options(n * each + extra, 6), answer: n * each + extra, hint: `${n} × ${each} + ${extra}` };
  }
  if (kind === 'dado') {
    const a = rnd(1, 6), b = rnd(1, 6);
    if (!hard || Math.random() < 0.5) return { prompt: 'Los dados dicen la distancia. ¿Cuánto suman?', dice: [a, b], options: options(a + b, 3), answer: a + b, hint: `${a} + ${b}` };
    const c = rnd(2, 6);
    return { prompt: `Dos dados suman ${a + b}. Si tiro el doble de ${c}, ¿cuánto es?`, options: options(c * 2, 4), answer: c * 2, hint: `El doble de ${c}` };
  }
  if (kind === 'calavera') {
    if (Math.random() < 0.5) {
      const a = hard ? rnd(20, 90) : rnd(5, 40), b = hard ? rnd(10, 60) : rnd(3, 30), r = a + b;
      return { prompt: `La llave del cofre tiene un número secreto: ☐ + ${b} = ${r}. ¿Cuál es?`, options: options(a, 6), answer: a, hint: `${r} − ${b}` };
    }
    const a = hard ? rnd(30, 99) : rnd(10, 60), b = rnd(3, Math.min(a, 40));
    return { prompt: `Tenía ${a} monedas de oro y la calavera me robó ${b}. ¿Cuántas me quedan?`, options: options(a - b, 5), answer: a - b, hint: `${a} − ${b}` };
  }
  // ronca: tables and sequences
  if (Math.random() < 0.5) {
    const a = hard ? rnd(6, 12) : rnd(2, 9), b = hard ? rnd(6, 12) : rnd(2, 9);
    return { prompt: `El pirata ronca ${a} veces por hora durante ${b} horas. ¿Cuántos ronquidos son?`, options: options(a * b, 8), answer: a * b, hint: `${a} × ${b}` };
  }
  const step = hard ? rnd(3, 9) : rnd(2, 6), start = rnd(1, 12);
  const seq = [0, 1, 2, 3].map((i) => start + step * i);
  return { prompt: `Siguiente número de la serie: ${seq.join(', ')}, ☐`, options: options(start + step * 4, 5), answer: start + step * 4, hint: `Sumá ${step} cada vez` };
}

const NAMES: Record<EnemyKind, string> = { dado: 'Dado Rodante', calavera: 'Calavera del Cofre', ronca: 'Pirata Ronco', sabio: 'Quimerius, el Sabio' };
const SPRITE: Record<EnemyKind, [string, number, number]> = {
  dado: ['pira/images/characters/DADOS/DadoA01.png', 300, 300], calavera: ['pira/images/characters/calavera/Calavera01.png', 340, 340], ronca: ['pira/images/level1/PirataRonca/Pirata_Ronca_01.png', 340, 340], sabio: ['caza/objects/npc005_quimerius/images/npc005_quimerius_default_default_s001.png', 312, 343],
};

export interface DuelResult { won: boolean; correct: number }

export class DuelScene implements Scene {
  private qs: DuelQ[] = [];
  private i = 0;
  private correct = 0;
  private timeLeft = 14;
  private sel = 0;
  private flash = 0;
  private flashOk = false;
  private done = false;
  private t = 0;
  private revealed = false;
  /** seconds per question: Normal gives more time and shows the hint by itself */
  private limit = 14;

  constructor(private kind: EnemyKind, private cb: (r: DuelResult) => void, private rounds = 3, private need = 2) {}

  enter(): void {
    const year = save().flags.year ?? 5;
    this.qs = Array.from({ length: this.rounds }, () => makeQuestion(this.kind, year));
    this.limit = isEasy() ? 22 : 14;
    this.timeLeft = this.limit;
  }

  update(dt: number, app: App): void {
    this.t += dt;
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) {
        this.i++; this.timeLeft = this.limit; this.sel = 0; this.revealed = false;
        if (this.i >= this.qs.length) { this.done = true; app.pop(); this.cb({ won: this.correct >= this.need, correct: this.correct }); }
      }
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.answer(null);
    const q = this.qs[this.i];
    if (!q) return;
    if (isPressed('left') || isPressed('up')) this.sel = (this.sel + 3) % 4;
    if (isPressed('right') || isPressed('down')) this.sel = (this.sel + 1) % 4;
    for (let k = 0; k < 4; k++) if (keyPressed(`Digit${k + 1}`)) this.answer(k);
    if (isPressed('act')) this.answer(this.sel);
    if (keyPressed('KeyH')) this.revealed = true;
    if (isEasy() && this.limit - this.timeLeft > 6) this.revealed = true;
  }

  private answer(k: number | null): void {
    const q = this.qs[this.i];
    if (!q || this.flash > 0) return;
    const ok = k !== null && q.options[k] === q.answer;
    if (ok) this.correct++;
    this.flashOk = ok;
    this.flash = 1.1;
    playSound(ok ? 'caza/sounds/console/right.ogg' : 'caza/sounds/console/wrong.ogg', 0.7);
    if (k !== null) this.sel = k;
  }

  private boxes(): { x: number; y: number; w: number; h: number }[] {
    return [0, 1, 2, 3].map((k) => ({ x: 520 + (k % 2) * 330, y: 520 + Math.floor(k / 2) * 120, w: 310, h: 100 }));
  }

  render(g: CanvasRenderingContext2D): void {
    const bg = img('caza/screens/inventory/img_background.png');
    g.fillStyle = '#12030c'; g.fillRect(0, 0, W, H);
    if (bg) g.drawImage(bg, 0, 0, W, H);
    const q = this.qs[this.i];
    // enemy
    const [path, sw, sh] = SPRITE[this.kind];
    const keyed = this.kind !== 'dado' ? true : true;
    const es = img(path, keyed);
    if (es) { const bob = Math.sin(this.t * 3) * 6; g.drawImage(es, 70, 190 + bob, sw, sh); }
    pixOrText(g, NAMES[this.kind], 235, 150, { size: this.kind === 'sabio' ? 22 : 30, align: 'center', color: '#ff9a6a', outline: '#000' });
    pixOrText(g, `Ronda ${Math.min(this.i + 1, this.qs.length)}/${this.qs.length}  ·  Aciertos ${this.correct}`, W - 56, 62, { size: 26, align: 'right', color: '#9fe8ff', outline: '#001' });
    if (!q) return;
    // question
    g.save(); roundRect(g, 470, 110, 680, 360, 20); g.fillStyle = 'rgba(10,20,40,0.7)'; g.fill(); g.strokeStyle = '#6fa8c8'; g.lineWidth = 3; g.stroke(); g.restore();
    paragraph(g, q.prompt, 500, 180, 620, 52, { size: 40, color: '#e8f6ff', weight: 500 });
    if (q.dice) {
      const n = q.dice.length + (q.missing ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const x = 810 - (n * 190 - 40) / 2 + k * 190;
        const d = q.dice[k];
        if (d === undefined) { text(g, '?', x + 75, 370, { size: 120, align: 'center', color: '#ffe066', weight: 800, outline: '#000', outlineW: 8 }); continue; }
        const im = img(`pira/images/characters/DADOS/DadoB0${d}.png`, true) ?? img(`pira/images/characters/DADOS/DadoA0${d}.png`, true);
        if (im) g.drawImage(im, x, 270, 150, 150);
        if (k < n - 1) text(g, '+', x + 170, 370, { size: 70, align: 'center', color: '#ffe066', weight: 800 });
      }
    }
    if (this.revealed) text(g, `Pista: ${q.hint}`, 810, 455, { size: 26, align: 'center', color: '#ffe066' });
    // timer
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(520, 480, 640, 12);
    g.fillStyle = this.timeLeft > 5 ? '#6af09a' : '#ff6a5a'; g.fillRect(520, 480, 640 * Math.max(0, this.timeLeft / this.limit), 12);
    // options
    const rects = this.boxes();
    q.options.forEach((o, k) => {
      const r = rects[k];
      const over = pointer.inside && pointer.x >= r.x && pointer.x < r.x + r.w && pointer.y >= r.y && pointer.y < r.y + r.h;
      if (over && this.flash <= 0) this.sel = k;
      const isAns = this.flash > 0 && o === q.answer;
      const wrongPick = this.flash > 0 && this.sel === k && o !== q.answer;
      g.fillStyle = isAns ? 'rgba(40,160,80,0.9)' : wrongPick ? 'rgba(180,40,40,0.9)' : this.sel === k ? 'rgba(200,170,60,0.9)' : 'rgba(30,40,70,0.9)';
      roundRect(g, r.x, r.y, r.w, r.h, 16); g.fill();
      g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.stroke();
      text(g, q.labels?.[k] ?? String(o), r.x + r.w / 2, r.y + r.h / 2, { size: q.labels ? 48 : 56, align: 'center', baseline: 'middle', color: '#fff', weight: 800 });
      text(g, String(k + 1), r.x + 18, r.y + 30, { size: 24, color: '#bcd', baseline: 'middle' });
      if (over && pointer.clicked) this.answer(k);
    });
    text(g, isEasy() ? 'Clic / 1-4 / flechas + Espacio    H: pista (Normal: aparece sola)' : 'Clic / 1-4 / flechas + Espacio    H: pista', W / 2, H - 40, { size: 24, align: 'center', color: '#9fb0c8' });
    // touch-friendly hint button
    if (!this.revealed && this.flash <= 0) {
      const hb = { x: 1040, y: 404, w: 110, h: 50 };
      const ov = pointer.inside && pointer.x >= hb.x && pointer.x < hb.x + hb.w && pointer.y >= hb.y && pointer.y < hb.y + hb.h;
      g.fillStyle = ov ? 'rgba(255,224,102,0.9)' : 'rgba(255,224,102,0.6)'; roundRect(g, hb.x, hb.y, hb.w, hb.h, 12); g.fill();
      text(g, 'Pista', hb.x + hb.w / 2, hb.y + 34, { size: 26, align: 'center', weight: 800, color: '#3a2412' });
      if (ov && pointer.clicked) this.revealed = true;
    }
    if (this.flash > 0) text(g, this.flashOk ? '¡Correcto!' : '¡Ups!', W / 2, 90, { size: 70, align: 'center', color: this.flashOk ? '#58ff9a' : '#ff7a6a', weight: 800, outline: '#000', outlineW: 10 });
    void this.done;
  }
}
