// Nivel 2 - La cueva del pirata Olivera: Pi hops from signpost to signpost in numeric order (click / tap the next number).
// The long gaps need Flo: wait for the parrot to carry you, or fall.
import { img } from '../core/assets';
import { playSound } from '../core/audio';
import { pointer } from '../core/input';
import { A, FLO, FX, PI, PiraLevel, drawCentered, drawFeet, type PiraResult } from './base';
import { W, H } from '../core/app';
import { text } from '../ui/text';

interface Spot { x: number; y: number; long: boolean }
const SPOTS: Spot[] = [
  { x: 230, y: 742, long: false }, { x: 112, y: 546, long: false }, { x: 312, y: 294, long: false }, { x: 860, y: 238, long: true },
  { x: 1048, y: 402, long: false }, { x: 1084, y: 548, long: false }, { x: 862, y: 606, long: false }, { x: 760, y: 826, long: false },
  { x: 470, y: 862, long: true }, { x: 150, y: 846, long: true },
];

type Mode = 'idle' | 'jump' | 'wait' | 'carry' | 'fall';

export class Level2 extends PiraLevel {
  private cur = 0;                       // index of the sign Pi stands on
  private mode: Mode = 'idle';
  private mt = 0;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private dur = 1;
  private px = 0;
  private py = 0;
  private target = -1;
  private fallFrom = 0;
  private msg = '';
  private msgT = 0;

  constructor(done: (r: PiraResult) => void) { super(2, done, 3); }

  protected assets() {
    const n = (i: number) => String(i).padStart(2, '0');
    return {
      keyed: [
        ...Array.from({ length: 10 }, (_, i) => ['A', 'B', 'C'].map((c) => A(`images/level2/Carteles/N${i + 1}_${c}.png`))).flat(),
        ...Array.from({ length: 3 }, (_, i) => PI + `Pi_Salto_0${i}.png`), PI + 'Pi_00.png', PI + 'Pi_01.png',
        ...Array.from({ length: 14 }, (_, i) => PI + `PiCae${n(i + 1)}.png`),
        ...Array.from({ length: 8 }, (_, i) => PI + `PiConLoro0${i}.png`),
        ...Array.from({ length: 5 }, (_, i) => FLO + `Loro_0${i + 1}.png`),
        ...Array.from({ length: 10 }, (_, i) => A(`images/level2/Numeros/Numeros_${n(i + 1)}.png`)),
      ],
      plain: [A('images/level2/Fondos/Fondo_01.jpg')],
      sounds: ['Cae', 'Cambio_de_Color', 'Salto'].map((s) => FX(`NIVEL_2/${s}.ogg`)),
    };
  }

  protected start(): void {
    this.cur = 0; this.mode = 'idle'; this.mt = 0;
    this.px = SPOTS[0].x; this.py = SPOTS[0].y;
    this.say('Saltá de cartel en cartel: 1, 2, 3…');
  }
  private say(s: string): void { this.msg = s; this.msgT = 3; }

  protected tick(dt: number): void {
    if (this.msgT > 0) this.msgT -= dt;
    this.mt += dt;
    const clicked = pointer.pressed ? this.signAt(pointer.x, pointer.y) : -1;
    switch (this.mode) {
      case 'idle':
        if (clicked >= 0 && clicked !== this.cur) this.attempt(clicked);
        break;
      case 'wait': {
        // Pi waits at the edge for Flo; a click on any sign now means jumping alone
        if (clicked >= 0 && clicked !== this.cur) { this.mode = 'jump'; this.beginJump(clicked, true); break; }
        if (this.mt > 1.7) { this.mode = 'carry'; this.mt = 0; this.from = { x: this.px, y: this.py }; this.to = { x: SPOTS[this.target].x, y: SPOTS[this.target].y }; this.dur = 1.6; playSound(FX('NIVEL_2/Salto.ogg'), 0.6); }
        break;
      }
      case 'jump': {
        const k = Math.min(1, this.mt / this.dur);
        this.px = this.from.x + (this.to.x - this.from.x) * k;
        this.py = this.from.y + (this.to.y - this.from.y) * k - Math.sin(k * Math.PI) * 150;
        if (k >= 1) this.land();
        break;
      }
      case 'carry': {
        const k = Math.min(1, this.mt / this.dur);
        const e = k * k * (3 - 2 * k);
        this.px = this.from.x + (this.to.x - this.from.x) * e;
        this.py = this.from.y + (this.to.y - this.from.y) * e - Math.sin(k * Math.PI) * 90;
        if (k >= 1) this.land();
        break;
      }
      case 'fall':
        this.py += 520 * dt;
        this.px += (this.to.x - this.fallFrom) * dt * 0.4;
        if (this.mt > 1.3) {
          if (!this.loseLife()) { this.mode = 'idle'; this.px = SPOTS[this.cur].x; this.py = SPOTS[this.cur].y; }
        }
        break;
    }
  }

  private signAt(x: number, y: number): number {
    let best = -1, bd = 1e9;
    SPOTS.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - 50 - y); if (d < 90 && d < bd) { bd = d; best = i; } });
    return best;
  }

  private attempt(i: number): void {
    const want = this.cur + 1;
    if (i !== want) {
      // wrong order: Pi jumps anyway and falls
      this.beginJump(i, true);
      this.say(`¡Era el ${want + 1}! Seguí el orden de los números`);
      return;
    }
    const s = SPOTS[want];
    if (s.long) { this.mode = 'wait'; this.mt = 0; this.target = want; this.say('¡Esperá a Flo! No lo intentes solo'); return; }
    this.beginJump(i, false);
  }

  private beginJump(i: number, willFall: boolean): void {
    this.target = i;
    this.mode = 'jump';
    this.mt = 0;
    this.from = { x: this.px, y: this.py };
    this.to = { x: SPOTS[i].x, y: SPOTS[i].y };
    const dist = Math.hypot(this.to.x - this.from.x, this.to.y - this.from.y);
    this.dur = 0.55 + dist / 900;
    playSound(FX('NIVEL_2/Salto.ogg'), 0.7);
    if (willFall || SPOTS[i].long) { this.willFall = true; } else this.willFall = false;
  }
  private willFall = false;

  private land(): void {
    if (this.willFall) {
      this.willFall = false;
      this.mode = 'fall'; this.mt = 0; this.fallFrom = this.px;
      playSound(FX('NIVEL_2/Cae.ogg'), 0.8);
      return;
    }
    this.cur = this.target;
    this.px = SPOTS[this.cur].x; this.py = SPOTS[this.cur].y;
    this.mode = 'idle';
    this.addScore(100);
    playSound(FX('NIVEL_2/Cambio_de_Color.ogg'), 0.6);
    if (this.cur === SPOTS.length - 1) { this.addScore(Math.max(0, Math.round(500 - this.playT * 4))); this.finish(true); }
  }

  protected draw(g: CanvasRenderingContext2D): void {
    const bg = img(A('images/level2/Fondos/Fondo_01.jpg'));
    if (bg) g.drawImage(bg, 0, 0, W, H);
    // signs
    SPOTS.forEach((s, i) => {
      const st = i === this.cur ? 'B' : i < this.cur ? 'C' : 'A';
      const next = i === this.cur + 1;
      const im = img(A(`images/level2/Carteles/N${i + 1}_${st}.png`), true);
      if (im) {
        g.save();
        if (next && this.mode === 'idle') { g.shadowColor = '#ffd873'; g.shadowBlur = 22 + Math.sin(this.t * 6) * 8; }
        drawFeet(g, im, s.x + (i % 2 ? 46 : -46), s.y + 6, 0.62);
        g.restore();
      }
      if (s.long) text(g, 'Flo', s.x, s.y + 28, { size: 16, align: 'center', color: 'rgba(255,255,255,0.55)' });
    });
    // Flo flying in when carrying
    if (this.mode === 'carry') {
      // Flo is part of the PiConLoro picture
    }
    // Pi
    let pic: string;
    let scale = 0.5;
    let flip = this.target >= 0 && SPOTS[Math.max(0, this.target)].x > this.from.x && (this.mode === 'jump' || this.mode === 'carry');
    if (this.mode === 'carry') { pic = PI + `PiConLoro0${Math.floor(this.mt * 8) % 8}.png`; scale = 0.5; }
    else if (this.mode === 'jump') { const k = this.mt / this.dur; pic = PI + `Pi_Salto_0${k < 0.15 ? 0 : k > 0.85 ? 2 : 1}.png`; }
    else if (this.mode === 'fall') pic = PI + `PiCae${String(Math.min(14, 1 + Math.floor(this.mt * 12))).padStart(2, '0')}.png`;
    else pic = PI + 'Pi_00.png';
    if (this.mode === 'idle' || this.mode === 'wait') flip = false;
    const im = img(pic, true);
    if (this.mode === 'carry') drawFeet(g, im, this.px, this.py + 40, scale, flip);
    else drawFeet(g, im, this.px, this.py + 14, scale, flip);
    if (this.mode === 'wait') {
      const k = Math.min(1, this.mt / 1.7);
      drawCentered(g, img(FLO + `Loro_0${1 + (Math.floor(this.t * 12) % 5)}.png`, true), SPOTS[this.cur].x + 320 * (1 - k), SPOTS[this.cur].y - 150 - 60 * Math.sin(k * 3), 0.7);
    }
    // next number
    const next = Math.min(SPOTS.length, this.cur + 2);
    text(g, `Siguiente: ${next}`, W / 2, 90, { size: 44, align: 'center', color: '#ffe9a8', weight: 800, outline: '#000', outlineW: 9 });
    if (this.msgT > 0) text(g, this.msg, W / 2, H - 44, { size: 36, align: 'center', color: '#fff4c8', outline: '#000', outlineW: 8, alpha: Math.min(1, this.msgT) });
  }
}
