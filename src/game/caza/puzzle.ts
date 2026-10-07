// The puzzle console: Cazaproblemas exercises (decrypted bank: public/assets/caza/puzzles/puzzles.json) shown on the original steampunk
// console picture. Layout tree = rows/columns in percent, leaves = label / image / multiple choice / text input / sudoku.
import { App, W, H, type Scene } from '../core/app';
import { img, json } from '../core/assets';
import { playSound } from '../core/audio';
import { isPressed, keyPressed, pointer, takeTyped } from '../core/input';
import { setFont, text as drawText } from '../ui/text';
import { wrap } from '../core/app';
import { save, commit, isEasy } from '../save';

export interface Node {
  k: 'body' | 'row' | 'col' | 'label' | 'image' | 'mc' | 'text' | 'sudoku';
  w?: number; h?: number; c?: Node[];
  text?: string; size?: number; top?: boolean; src?: string; n?: number; name?: string; x?: number; y?: number;
}
export interface Exercise { id: number; points: number; clues: string[]; body: Node; answers: Record<string, string>[] }

let bank: Exercise[] | null = null;
export async function loadPuzzles(): Promise<Exercise[]> {
  if (!bank) bank = await json<Exercise[]>('caza/puzzles/puzzles.json');
  return bank;
}
export const puzzleById = (id: number): Exercise | undefined => bank?.find((p) => p.id === id);

const S = 2; // 600x450 -> 1200x900
const MONO = 'CPMono, "Courier New", monospace';
type Cell = { x: number; y: number; w: number; h: number };
interface Hit { kind: 'mc' | 'text' | 'cell'; name: string; r: Cell; idx?: number }

export interface PuzzleResult { correct: boolean; points: number; clues: number }

export class PuzzleScene implements Scene {
  private ex!: Exercise;
  private values: Record<string, string> = {};
  private hits: Hit[] = [];
  private focus = '';
  private cluesUsed = new Set<number>();
  private showClues = false;
  private phase: 'play' | 'right' | 'wrong' | 'exit' = 'play';
  private pt = 0;
  private sudoku: { grid: number[]; fixed: boolean[] } | null = null;
  private t = 0;
  private done = false;

  constructor(private id: number, private cb: (r: PuzzleResult) => void) {}

  async enter(app: App): Promise<void> {
    const all = await loadPuzzles();
    this.ex = all.find((p) => p.id === this.id) ?? all[0];
    if (this.hasSudoku(this.ex.body)) this.makeSudoku();
    app.state.scene = 'puzzle';
    app.state.touch = 'none';
  }

  private hasSudoku(n: Node): boolean { return n.k === 'sudoku' || (n.c ?? []).some((c) => this.hasSudoku(c)); }
  private makeSudoku(): void {
    const base = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
    const perm = [0, 1, 2].sort(() => Math.random() - 0.5);
    const rows = [0, 1, 2].sort(() => Math.random() - 0.5);
    const grid: number[] = [];
    for (const r of rows) for (let c = 0; c < 3; c++) grid.push(perm[base[r][c]] + 1);
    const fixed = grid.map(() => false);
    const keep = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, 3);
    keep.forEach((i) => { fixed[i] = true; });
    this.sudoku = { grid: grid.map((v, i) => (fixed[i] ? v : 0)), fixed };
    this.solution = grid;
  }
  private solution: number[] = [];

  // ------------------------------------------------------------------ scoring
  private pointsNow(): number {
    const n = this.cluesUsed.size;
    if (isEasy()) return Math.round(this.ex.points * Math.max(0.6, 1 - 0.1 * Math.max(0, n - 1)));
    return Math.round(this.ex.points * Math.max(0.25, 1 - 0.25 * n));
  }

  private check(): boolean {
    if (this.sudoku) {
      const g = this.sudoku.grid;
      if (g.some((v) => !v)) return false;
      for (let i = 0; i < 3; i++) {
        const row = new Set([g[i * 3], g[i * 3 + 1], g[i * 3 + 2]]);
        const col = new Set([g[i], g[i + 3], g[i + 6]]);
        if (row.size < 3 || col.size < 3) return false;
      }
      return true;
    }
    const ans = this.ex.answers[0] ?? {};
    return Object.entries(ans).every(([k, v]) => (this.values[k] ?? '').trim().toLowerCase().replace(',', '.') === v.trim().toLowerCase().replace(',', '.'));
  }

  private finish(correct: boolean): void {
    if (this.done) return;
    this.done = true;
    const pts = correct ? this.pointsNow() : 0;
    if (correct) {
      const s = save();
      s.score += pts;
      if (!s.solved.includes(this.ex.id)) s.solved.push(this.ex.id);
      s.failed = s.failed.filter((i) => i !== this.ex.id);
    } else if (!save().failed.includes(this.ex.id)) save().failed.push(this.ex.id);
    commit();
    this.result = { correct, points: pts, clues: this.cluesUsed.size };
  }
  private result: PuzzleResult | null = null;

  // ------------------------------------------------------------------ update / render
  update(dt: number, app: App): void {
    this.t += dt;
    if (this.phase === 'right' || this.phase === 'wrong') {
      this.pt += dt;
      if (this.pt > 1.8 || (this.pt > 0.5 && (isPressed('act') || pointer.clicked))) { app.pop(); this.cb(this.result!); }
      return;
    }
    if (this.wantsExit || (this.phase === 'exit' && (isPressed('act') || keyPressed('KeyY')))) { this.finish(false); app.pop(); this.cb(this.result!); return; }
    if (this.phase === 'exit') {
      if (isPressed('back') || keyPressed('KeyN')) this.phase = 'play';
      return;
    }
    if (this.showClues) { if (isPressed('back') || isPressed('act')) this.showClues = false; return; }
    // typed text goes to the focused text input
    const typed = takeTyped();
    if (this.focus && this.focus in this.values) {
      let v = this.values[this.focus];
      for (const ch of typed) { if (ch === '\b') v = v.slice(0, -1); else if (/[0-9.,/\-a-zA-Z ]/.test(ch) && v.length < 12) v += ch; }
      this.values[this.focus] = v;
    }
    if (isPressed('back')) { this.phase = 'exit'; return; }
    if (keyPressed('Enter')) this.submit();
    if (isPressed('left') || isPressed('right')) this.moveMc(isPressed('right') ? 1 : -1);
  }

  private moveMc(d: number): void {
    const mcs = this.hits.filter((h) => h.kind === 'mc');
    if (!mcs.length) return;
    const name = mcs[0].name;
    const n = mcs.length;
    const cur = Number(this.values[name] || 0);
    const nx = Math.min(n, Math.max(1, (cur || (d > 0 ? 0 : n + 1)) + d));
    this.values[name] = String(nx);
  }

  private submit(): void {
    const ok = this.check();
    this.finish(ok);
    this.phase = ok ? 'right' : 'wrong';
    this.pt = 0;
    playSound(ok ? 'caza/sounds/console/right.ogg' : 'caza/sounds/console/wrong.ogg');
  }

  render(g: CanvasRenderingContext2D): void {
    const bg = img('caza/screens/inventory/img_background.png');
    g.fillStyle = '#12030c';
    g.fillRect(0, 0, W, H);
    if (bg) g.drawImage(bg, 0, 0, W, H);
    const bar = img('caza/screens/inventory/img_controls.png');
    if (bar && this.phase === 'play') g.drawImage(bar, 0, H - 230, W, 230);
    if (this.phase === 'right' || this.phase === 'wrong') {
      const o = img(this.phase === 'right' ? 'caza/screens/inventory/puzzles/img_right.png' : 'caza/screens/inventory/puzzles/img_wrong.png');
      if (o) g.drawImage(o, 0, 0, W, H);
      if (this.phase === 'right' && this.result) {
        drawText(g, `+${this.result.points} puntos`, W / 2, 560, { size: 54, align: 'center', color: '#58ff9a', outline: '#031', outlineW: 8, weight: 700 });
        drawText(g, `Total: ${save().score}`, W / 2, 630, { size: 36, align: 'center', color: '#bfffd8' });
      } else if (this.phase === 'wrong') {
        const ans = this.ex.answers[0];
        void ans;
        drawText(g, 'Puedes intentarlo de nuevo más tarde', W / 2, 580, { size: 36, align: 'center', color: '#ffb0a0' });
      }
      return;
    }
    this.hits = [];
    // header
    drawText(g, `Problema ${this.ex.id}`, 56, 62, { size: 30, color: '#9fe8ff', baseline: 'middle' });
    drawText(g, `${this.pointsNow()} pts`, 1144, 62, { size: 30, color: '#ffe066', align: 'right', baseline: 'middle' });
    this.layout(g, this.ex.body, { x: 40, y: 90, w: 1120, h: 520 }, 'col');
    // the sudoku registers its cells as hit areas, so it must be drawn BEFORE the click handling in controls()
    if (this.sudoku) this.drawSudoku(g);
    this.controls(g);
    this.keypad(g);
    if (this.showClues) this.drawClues(g);
    if (this.phase === 'exit') this.drawExit(g);
  }

  private controls(g: CanvasRenderingContext2D): void {
    // OK / clues / notes zones over the console bar picture (positions measured on the 600x450 art)
    const ok = { x: 1000, y: 790, w: 180, h: 70 };
    const cl = { x: 800, y: 790, w: 100, h: 90 };
    const ex = { x: 10, y: 800, w: 100, h: 90 };
    const over = (r: Cell) => pointer.inside && pointer.x >= r.x && pointer.x < r.x + r.w && pointer.y >= r.y && pointer.y < r.y + r.h;
    for (const [r, label, col] of [[ok, 'OK', '#ff4a4a'], [cl, `Pistas ${this.cluesUsed.size}/3`, '#ffe066'], [ex, 'Salir', '#ff9a6a']] as [Cell, string, string][]) {
      const o = over(r);
      if (o) { g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(r.x, r.y, r.w, r.h); }
      drawText(g, label, r.x + r.w / 2, r.y + r.h / 2, { size: label === 'OK' ? 46 : 26, align: 'center', baseline: 'middle', color: col, weight: 700, outline: '#000', outlineW: 6 });
    }
    if (pointer.clicked && !this.showClues && this.phase === 'play') {   // overlays (clues, exit) keep their own clicks
      if (over(ok)) this.submit();
      else if (over(cl)) { if (!this.showClues) { this.showClues = true; } }
      else if (over(ex)) this.phase = 'exit';
      for (const h of this.hits) {
        if (!over(h.r)) continue;
        if (h.kind === 'mc') this.values[h.name] = String(h.idx! + 1);
        else if (h.kind === 'text') this.focus = h.name;
        else if (h.kind === 'cell' && this.sudoku && !this.sudoku.fixed[h.idx!]) this.sudoku.grid[h.idx!] = (this.sudoku.grid[h.idx!] + 1) % 4;
      }
    }
  }

  /** On-screen number pad (touch devices have no keyboard for the text answers). */
  private keypad(g: CanvasRenderingContext2D): void {
    if (!this.hits.some((h) => h.kind === 'text') || this.showClues || !this.coarse) return;
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫'];
    const x0 = 760, y0 = 330, w = 120, h = 70;
    g.fillStyle = 'rgba(0,10,20,0.82)'; g.fillRect(x0 - 14, y0 - 14, w * 3 + 40, h * 4 + 40);
    g.strokeStyle = '#6fa8c8'; g.lineWidth = 3; g.strokeRect(x0 - 14, y0 - 14, w * 3 + 40, h * 4 + 40);
    keys.forEach((k, i) => {
      const r = { x: x0 + (i % 3) * (w + 8), y: y0 + Math.floor(i / 3) * (h + 8), w, h };
      const over = pointer.inside && pointer.x >= r.x && pointer.x < r.x + r.w && pointer.y >= r.y && pointer.y < r.y + r.h;
      g.fillStyle = over ? 'rgba(111,168,200,0.55)' : 'rgba(40,70,100,0.8)'; g.fillRect(r.x, r.y, r.w, r.h);
      drawText(g, k, r.x + r.w / 2, r.y + r.h / 2, { size: 40, align: 'center', baseline: 'middle', color: '#fff', weight: 700 });
      if (over && pointer.clicked && this.focus) {
        const v = this.values[this.focus] ?? '';
        this.values[this.focus] = k === '⌫' ? v.slice(0, -1) : v.length < 12 ? v + k : v;
      }
    });
  }
  private coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  private drawClues(g: CanvasRenderingContext2D): void {
    const bg = img('caza/screens/inventory/clues/img_background.png');
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, 0, W, H);
    if (bg) g.drawImage(bg, 40, 100, 1120, 620);
    drawText(g, isEasy() ? 'Pistas (Normal: la primera es gratis, las demás restan poco)' : 'Pistas (Difícil: cada una resta 25% de los puntos)', W / 2, 150, { size: 34, align: 'center', color: '#ffe9a8' });
    let y = 210;
    for (let i = 0; i < 3; i++) {
      const r: Cell = { x: 80, y, w: 1040, h: 150 };
      const used = this.cluesUsed.has(i);
      g.fillStyle = used ? 'rgba(20,40,20,0.8)' : 'rgba(40,10,20,0.85)';
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.strokeRect(r.x, r.y, r.w, r.h);
      drawText(g, String(i + 1), r.x + 40, r.y + r.h / 2, { size: 54, color: '#ffe066', baseline: 'middle', weight: 800 });
      if (used) {
        setFont(g, 28, 400);
        const lines = wrap(g, this.ex.clues[i], r.w - 140);
        lines.slice(0, 4).forEach((l, k) => drawText(g, l, r.x + 100, r.y + 38 + k * 34, { size: 28, color: '#e8f4ff', baseline: 'middle' }));
      } else drawText(g, 'Tocá para ver esta pista', r.x + 100, r.y + r.h / 2, { size: 28, color: '#b0a080', baseline: 'middle' });
      if (pointer.clicked && pointer.x >= r.x && pointer.x < r.x + r.w && pointer.y >= r.y && pointer.y < r.y + r.h) { this.cluesUsed.add(i); playSound('caza/sounds/console/btn_press.ogg'); }
      y += 170;
    }
    drawText(g, 'Esc / Espacio: cerrar', W / 2, 760, { size: 26, align: 'center', color: '#9fb0c8' });
  }

  private drawExit(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(0, 0, W, H);
    const bg = img('caza/screens/inventory/exit/img_background.png');
    if (bg) g.drawImage(bg, 220, 280, 760, 330);
    ['Si sales sin resolver el ejercicio', 'podrás intentarlo luego, pero', 'no obtendrás puntos.', '¿Estás seguro que deseas salir?'].forEach((l, i) =>
      drawText(g, l, W / 2, 360 + i * 44, { size: 30, align: 'center', color: '#f0f4ff', baseline: 'middle' }));
    const yes: Cell = { x: 380, y: 530, w: 180, h: 60 }, no: Cell = { x: 640, y: 530, w: 180, h: 60 };
    for (const [r, l] of [[yes, 'Sí (Espacio)'], [no, 'No (Esc)']] as [Cell, string][]) {
      g.fillStyle = 'rgba(80,60,20,0.9)'; g.fillRect(r.x, r.y, r.w, r.h); g.strokeStyle = '#e0c060'; g.lineWidth = 3; g.strokeRect(r.x, r.y, r.w, r.h);
      drawText(g, l, r.x + r.w / 2, r.y + r.h / 2, { size: 26, align: 'center', baseline: 'middle', color: '#fff' });
    }
    if (pointer.clicked) {
      const inR = (r: Cell) => pointer.x >= r.x && pointer.x < r.x + r.w && pointer.y >= r.y && pointer.y < r.y + r.h;
      if (inR(yes)) this.wantsExit = true;
      else if (inR(no)) this.phase = 'play';
    }
  }
  private wantsExit = false;

  // ------------------------------------------------------------------ layout
  private layout(g: CanvasRenderingContext2D, n: Node, r: Cell, dir: 'row' | 'col'): void {
    switch (n.k) {
      case 'body': case 'col': case 'row': {
        const kids = n.c ?? [];
        if (!kids.length) return;
        const horizontal = n.k === 'row';
        const total = horizontal ? r.w : r.h;
        const given = kids.map((k) => (horizontal ? k.w : k.h));
        const known = given.reduce((a: number, v) => a + (v ?? 0), 0);
        const unknown = given.filter((v) => v === undefined).length;
        let pos = horizontal ? r.x : r.y;
        kids.forEach((k, i) => {
          const pct = given[i] !== undefined ? given[i]! : unknown ? Math.max(0, 100 - known) / unknown : 100 / kids.length;
          const size = known > 100 && unknown === 0 ? (total * pct) / known : (total * pct) / 100;
          const cell = horizontal ? { x: pos, y: r.y, w: size, h: r.h } : { x: r.x, y: pos, w: r.w, h: size };
          // a column inside a row keeps its width; a row inside a column its height; leaves fill the cell
          this.layout(g, k, cell, k.k === 'row' ? 'row' : 'col');
          pos += size;
        });
        void dir;
        break;
      }
      case 'label': {
        const size = (n.size ?? 16) * S * 0.92;
        setFont(g, size, 400);
        g.font = `400 ${size}px ${MONO}`;
        const lines = wrap(g, n.text ?? '', r.w - 12);
        const lh = size * 1.25;
        let y = n.top ? r.y + size : r.y + (r.h - lines.length * lh) / 2 + size * 0.9;
        // the original centers every label in its cell (the text box of fill-in answers is anchored right after the sentence)
        for (const l of lines) { g.fillStyle = '#e8f6ff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(l, r.x + r.w / 2, y); y += lh; }
        break;
      }
      case 'image': {
        const im = img('caza/puzzles/' + n.src!);
        if (!im) break;
        const iw = (im as HTMLImageElement).naturalWidth * S, ih = (im as HTMLImageElement).naturalHeight * S;
        const k = Math.min(1, r.w / iw, r.h / ih);
        const dw = iw * k, dh = ih * k;
        g.drawImage(im, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
        break;
      }
      case 'mc': {
        const im = img('caza/puzzles/' + n.src!);
        if (!im) break;
        const iw = (im as HTMLImageElement).naturalWidth * S, ih = (im as HTMLImageElement).naturalHeight * S;
        const k = Math.min(1, r.w / iw);
        const dw = iw * k, dh = ih * k;
        const x0 = r.x + (r.w - dw) / 2, y0 = r.y + (r.h - dh) / 2;
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x0 - 6, y0 - 4, dw + 12, dh + 8);
        g.drawImage(im, x0, y0, dw, dh);
        const cnt = n.n ?? 5;
        const cw = dw / cnt;
        const sel = Number(this.values[n.name!] || 0);
        for (let i = 0; i < cnt; i++) {
          const rr = { x: x0 + i * cw, y: y0 - 6, w: cw, h: dh + 12 };
          this.hits.push({ kind: 'mc', name: n.name!, r: rr, idx: i });
          const hov = pointer.inside && pointer.x >= rr.x && pointer.x < rr.x + rr.w && pointer.y >= rr.y && pointer.y < rr.y + rr.h;
          if (sel === i + 1 || hov) {
            g.strokeStyle = sel === i + 1 ? '#ffe066' : 'rgba(255,255,255,0.4)'; g.lineWidth = 4; g.strokeRect(rr.x + 4, rr.y + 2, rr.w - 8, rr.h - 4);
          }
          if (sel === i + 1) { const c = img('caza/screens/inventory/puzzles/img_mc_cursor.png'); if (c) g.drawImage(c, rr.x + rr.w / 2 - 19, rr.y + rr.h + 6, 38, 36); }
        }
        if (!(n.name! in this.values)) this.values[n.name!] = '';
        break;
      }
      case 'text': {
        const name = n.name!;
        if (!(name in this.values)) this.values[name] = '';
        const bx = (n.x ?? 0) * S, by = (n.y ?? 0) * S;
        const bw = Math.max(110, (n.w ?? 20) * S * 4);
        const rr: Cell = n.x !== undefined && n.x > 0 ? { x: bx, y: by - 24, w: bw, h: 56 } : { x: r.x + r.w / 2 - bw / 2, y: r.y + r.h / 2 - 28, w: bw, h: 56 };
        this.hits.push({ kind: 'text', name, r: rr });
        if (!this.focus) this.focus = name;
        g.fillStyle = 'rgba(0,30,50,0.85)'; g.fillRect(rr.x, rr.y, rr.w, rr.h);
        g.strokeStyle = this.focus === name ? '#ffe066' : '#6fa8c8'; g.lineWidth = 3; g.strokeRect(rr.x, rr.y, rr.w, rr.h);
        g.font = `400 40px ${MONO}`; g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
        const caret = this.focus === name && Math.floor(this.t * 2) % 2 === 0 ? '|' : '';
        g.fillText(this.values[name] + caret, rr.x + 12, rr.y + rr.h / 2);
        break;
      }
      case 'sudoku': break;
    }
  }

  private drawSudoku(g: CanvasRenderingContext2D): void {
    const s = this.sudoku!;
    const x0 = 760, y0 = 220, cs = 110;
    const bg = img('caza/puzzles/images/randomsudoku.png');
    if (bg) g.drawImage(bg, x0 - 4, y0 - 4, cs * 3 + 8, cs * 3 + 8);
    s.grid.forEach((v, i) => {
      const r: Cell = { x: x0 + (i % 3) * cs, y: y0 + Math.floor(i / 3) * cs, w: cs, h: cs };
      this.hits.push({ kind: 'cell', name: 'sudoku', r, idx: i });
      if (v) drawText(g, String(v), r.x + cs / 2, r.y + cs / 2, { size: 64, align: 'center', baseline: 'middle', color: s.fixed[i] ? '#ffe066' : '#9fe8ff', weight: 700 });
    });
    drawText(g, 'Tocá una casilla para cambiar el número', x0 + cs * 1.5, y0 + cs * 3 + 40, { size: 24, align: 'center', color: '#b0c8d8' });
  }
}
