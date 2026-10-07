// Nivel 5 - Tablero: two dice (one with numerals, one with pips) say how many tiles to hop. Add them in your head and press Space
// exactly that many times - never while the dice are spinning. Red tile +6, blue -3, black -6. Click the bombs to defuse them, duck (Down)
// when the skull throws a bone.
import { img } from '../core/assets';
import { playSound } from '../core/audio';
import { isPressed, pointer } from '../core/input';
import { A, FX, PI, PiraLevel, drawCentered, drawFeet, type PiraResult } from './base';
import { W, H } from '../core/app';
import { text } from '../ui/text';

type T = 'n' | 'R' | 'B' | 'K';
const ROW = (xs: number[], y: number, types: Record<number, T> = {}): { x: number; y: number; t: T }[] => xs.map((x) => ({ x, y, t: types[x] ?? 'n' }));
const PATH: { x: number; y: number; t: T }[] = [
  { x: 1040, y: 810, t: 'n' },                                                         // 0 start (big black oval)
  ...ROW([930, 860, 790, 720, 650, 580, 512, 442, 372, 302, 233, 168], 818, { 720: 'B', 650: 'R', 302: 'B' }),
  { x: 168, y: 715, t: 'n' },
  ...ROW([235, 305, 372, 443, 513, 580, 650, 720, 790, 855], 708, { 235: 'R', 305: 'B', 855: 'K' }),
  { x: 920, y: 690, t: 'n' },
  { x: 920, y: 595, t: 'n' },
  ...ROW([858, 790, 718, 650, 580, 508, 440, 372, 303, 232], 600, { 508: 'B', 440: 'R' }),
  ...ROW([232, 302, 372, 442], 495, { 232: 'K' }),
  { x: 435, y: 415, t: 'n' }, { x: 505, y: 415, t: 'B' }, { x: 575, y: 415, t: 'n' }, { x: 575, y: 330, t: 'n' },
];
const END = PATH.length - 1;
const DICE_C = [{ x: 108, y: 102 }, { x: 298, y: 102 }];

interface Bomb { idx: number; t: number; boom: number }
type Phase = 'roll' | 'hop' | 'fx' | 'idle';

export class Level5 extends PiraLevel {
  private pos = 0;
  private visual = { x: PATH[0].x, y: PATH[0].y };
  private st: Phase = 'roll';
  private pt = 0;
  private dice: [number, number] = [1, 1];
  private hops = 0;
  private startPos = 0;
  private fxQueue: number[] = [];       // tile indices Pi slides through (red/blue/black effects)
  private hopFrom = { x: 0, y: 0 };
  private hopT = 1;
  private hopTo = 0;
  private bombs: Bomb[] = [];
  private boneT = 7;
  private bone: { t: number; idx: number } | null = null;
  private duck = 0;
  private msg = '';
  private msgT = 0;
  private fall = 0;

  constructor(done: (r: PiraResult) => void) { super(5, done, 3); this.hudRight = true; }

  protected assets() {
    const n = (i: number) => String(i).padStart(2, '0');
    return {
      keyed: [
        ...['A', 'B'].flatMap((s) => Array.from({ length: 6 }, (_, i) => A(`images/characters/DADOS/Dado${s}${n(i + 1)}.png`))), A('images/characters/DADOS/Dado00.png'),
        ...Array.from({ length: 3 }, (_, i) => A(`images/level5/Bomba/Bomba${n(i + 1)}.png`)), ...Array.from({ length: 7 }, (_, i) => A(`images/level5/Bomba/BombaExplota${n(i + 1)}.png`)),
        ...Array.from({ length: 4 }, (_, i) => A(`images/characters/calavera/Calavera${n(i + 1)}.png`)), ...Array.from({ length: 4 }, (_, i) => A(`images/characters/Mano/ManoGira${n(i + 1)}.png`)),
        PI + 'Pi_00.png', PI + 'Pi_Salto_00.png', PI + 'Pi_Salto_01.png', PI + 'Pi_Salto_02.png', PI + 'Pi_Cae_00.png', PI + 'Pi_NO_00.png', PI + 'Pi_NO_01.png', PI + 'PiGolpeado.png',
        ...Array.from({ length: 14 }, (_, i) => PI + `PiCae${n(i + 1)}.png`),
      ],
      plain: [A('images/level5/Fondos/Fondo_01.jpg'), 'caza/objects/npc012_aurelia/images/npc012_aurelia_default.png'],
      sounds: ['Calavera_Tira_hueso', 'Casillero_Negativo', 'Casillero_Positivo', 'Dados', 'Hueso_colisiona_con_Pi', 'Pi_Cae', 'Pi_Renace', 'Espada'].map((s) => FX(`NIVEL_5/${s}.ogg`)),
    };
  }

  protected start(): void {
    this.pos = 0; this.visual = { x: PATH[0].x, y: PATH[0].y }; this.bombs = []; this.bone = null; this.boneT = 7; this.fall = 0;
    for (let i = 0; i < 5; i++) { const idx = 6 + Math.floor(Math.random() * (END - 8)); if (!this.bombs.some((b) => b.idx === idx)) this.bombs.push({ idx, t: 0, boom: 0 }); }
    this.roll();
  }
  private say(s: string): void { this.msg = s; this.msgT = 3; }

  private roll(): void {
    this.st = 'roll'; this.pt = 0; this.hops = 0; this.startPos = this.pos;
    this.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    playSound(FX('NIVEL_5/Dados.ogg'), 0.8);
    this.say('Sumá los dados... ¡y no te muevas mientras giran!');
  }

  private hop(): void {
    if (this.st === 'roll') { // moved while the dice were spinning
      this.say('¡Todavía giran los dados!'); this.pt = Math.max(0, this.pt - 0.6); return;
    }
    if (this.st !== 'hop' || this.hopT < 1) return;
    if (this.pos >= END) return;
    this.hops++;
    this.hopFrom = { ...this.visual };
    this.hopTo = Math.min(END, this.pos + 1);
    this.hopT = 0;
    playSound(FX('NIVEL_5/Espada.ogg'), 0.25);
  }

  protected tick(dt: number): void {
    if (this.msgT > 0) this.msgT -= dt;
    this.pt += dt;
    if (this.duck > 0) this.duck -= dt;
    if (isPressed('down')) this.duck = 0.9;
    if (isPressed('act')) this.hop();
    // bombs: click to defuse
    if (pointer.pressed) {
      for (const b of this.bombs) if (b.boom === 0 && Math.hypot(PATH[b.idx].x - pointer.x, PATH[b.idx].y - 20 - pointer.y) < 44) { this.bombs = this.bombs.filter((x) => x !== b); this.addScore(15); playSound(FX('NIVEL_5/Casillero_Positivo.ogg'), 0.4); break; }
    }
    for (const b of this.bombs) { b.t += dt; if (b.boom > 0) b.boom += dt; }
    this.bombs = this.bombs.filter((b) => b.boom < 0.8);
    // skull bone
    this.boneT -= dt;
    if (this.boneT <= 0 && !this.bone && this.st !== 'roll') { this.bone = { t: 0, idx: this.pos }; this.boneT = 10 + Math.random() * 6; playSound(FX('NIVEL_5/Calavera_Tira_hueso.ogg'), 0.6); }
    if (this.bone) {
      this.bone.t += dt;
      if (this.bone.t > 1.4) {
        const hit = this.duck <= 0 && this.bone.idx === this.pos;
        this.bone = null;
        if (hit) { playSound(FX('NIVEL_5/Hueso_colisiona_con_Pi.ogg'), 0.8); this.say('¡Te dio el hueso!'); this.loseLife(); }
      }
    }
    switch (this.st) {
      case 'roll':
        if (this.pt > 1.7) { this.st = 'hop'; this.pt = 0; this.say('¡Ahora saltá! (Espacio)'); }
        break;
      case 'hop': {
        if (this.hopT < 1) {
          this.hopT = Math.min(1, this.hopT + dt * 5);
          const a = PATH[this.pos], b = PATH[this.hopTo];
          this.visual = { x: a.x + (b.x - a.x) * this.hopT, y: a.y + (b.y - a.y) * this.hopT - Math.sin(this.hopT * Math.PI) * 55 };
          if (this.hopT >= 1) { this.pos = this.hopTo; this.visual = { x: b.x, y: b.y }; this.landed(); }
        } else if (this.pt > 6 && this.hops < this.dice[0] + this.dice[1] && this.hops > 0) {
          // took too long with a wrong count: evaluate what was done
          this.endTurn();
        }
        break;
      }
      case 'fx':
        if (this.hopT < 1) {
          this.hopT = Math.min(1, this.hopT + dt * 4);
          const a = PATH[this.pos], b = PATH[this.hopTo];
          this.visual = { x: a.x + (b.x - a.x) * this.hopT, y: a.y + (b.y - a.y) * this.hopT - Math.sin(this.hopT * Math.PI) * 30 };
          if (this.hopT >= 1) { this.pos = this.hopTo; this.visual = { x: b.x, y: b.y }; this.stepFx(); }
        }
        break;
      case 'idle':
        if (this.fall > 0) { this.fall -= dt; if (this.fall <= 0) { this.visual = { x: PATH[this.pos].x, y: PATH[this.pos].y }; this.roll(); } }
        else if (this.pt > 0.9) this.roll();
        break;
    }
  }

  private landed(): void {
    // bombs
    const bomb = this.bombs.find((b) => b.idx === this.pos && b.boom === 0);
    if (bomb) { bomb.boom = 0.001; this.hitBomb(); return; }
    const total = this.dice[0] + this.dice[1];
    if (this.hops === total) this.endTurn();
    else if (this.hops > total) { this.say(`¡Eran ${total}! Volvés al casillero anterior`); this.pos = this.startPos; this.fallAndRespawn(); }
  }

  private hitBomb(): void {
    this.say('¡Una bomba! Había que limpiarla con un clic');
    this.pos = this.startPos; this.fallAndRespawn();
  }

  private fallAndRespawn(): void {
    playSound(FX('NIVEL_5/Pi_Cae.ogg'), 0.8);
    this.st = 'idle'; this.pt = 0; this.fall = 1.3;
    if (this.loseLife()) return;
  }

  private endTurn(): void {
    const total = this.dice[0] + this.dice[1];
    if (this.hops !== total) { this.say(`Eran ${total}, saltaste ${this.hops}`); this.pos = this.startPos; this.fallAndRespawn(); return; }
    this.addScore(20);
    const t = PATH[this.pos].t;
    if (this.pos >= END) { this.addScore(Math.max(0, Math.round(500 - this.playT * 2))); this.finish(true); return; }
    if (t === 'n') { this.st = 'idle'; this.pt = 0; return; }
    const delta = t === 'R' ? 6 : t === 'B' ? -3 : -6;
    playSound(FX(delta > 0 ? 'NIVEL_5/Casillero_Positivo.ogg' : 'NIVEL_5/Casillero_Negativo.ogg'), 0.8);
    this.say(delta > 0 ? '¡Casillero rojo: avanzás 6!' : delta === -3 ? 'Casillero azul: retrocedés 3' : 'Casillero negro: retrocedés 6');
    this.fxQueue = [];
    let p = this.pos;
    const dir = delta > 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(delta); i++) { p = Math.max(0, Math.min(END, p + dir)); this.fxQueue.push(p); }
    this.st = 'fx'; this.hopT = 1; this.stepFx();
  }

  private stepFx(): void {
    const nx = this.fxQueue.shift();
    if (nx === undefined) { this.st = 'idle'; this.pt = 0; if (this.pos >= END) { this.addScore(300); this.finish(true); } return; }
    this.hopFrom = { ...this.visual }; this.hopTo = nx; this.hopT = 0;
  }

  protected draw(g: CanvasRenderingContext2D): void {
    const bg = img(A('images/level5/Fondos/Fondo_01.jpg'));
    if (bg) g.drawImage(bg, 0, 0, W, H);
    // skull at the top and the warning
    const sk = img(A(`images/characters/calavera/Calavera0${1 + (Math.floor(this.t * 2) % 4)}.png`), true);
    drawCentered(g, sk, 1010, 300, 0.55);
    // Aurelia watches the board from the corner
    drawFeet(g, img('caza/objects/npc012_aurelia/images/npc012_aurelia_default.png'), 60, 880, 1.4);
    // dice in the two circles
    const spin = this.st === 'roll' && this.pt < 1.7;
    this.dice.forEach((d, k) => {
      let n = d;
      if (spin) n = 1 + Math.floor(this.t * 14 + k * 3) % 6;
      const im = img(A(`images/characters/DADOS/Dado${k === 0 ? 'A' : 'B'}0${n}.png`), true);
      const shake = spin ? Math.sin(this.t * 40 + k) * 5 : 0;
      drawCentered(g, im, DICE_C[k].x + shake, DICE_C[k].y - 4, 1.05);
    });
    text(g, '+', 203, 112, { size: 70, align: 'center', color: '#ffe9a8', weight: 800 });
    if (!spin && this.st === 'hop') text(g, `Saltos: ${this.hops}`, 205, 200, { size: 34, align: 'center', color: '#fff', weight: 800, outline: '#7a2a12', outlineW: 7 });
    // bombs
    for (const b of this.bombs) {
      const p = PATH[b.idx];
      if (b.boom > 0) drawCentered(g, img(A(`images/level5/Bomba/BombaExplota0${Math.min(7, 1 + Math.floor(b.boom * 10))}.png`), true), p.x, p.y - 20, 0.8);
      else drawCentered(g, img(A(`images/level5/Bomba/Bomba0${1 + (Math.floor(b.t * 6) % 3)}.png`), true), p.x, p.y - 22, 0.55);
    }
    // bone warning
    if (this.bone) {
      const p = PATH[this.bone.idx];
      const k = this.bone.t / 1.4;
      g.strokeStyle = `rgba(255,40,30,${0.4 + 0.4 * Math.sin(this.t * 20)})`; g.lineWidth = 6; g.beginPath(); g.arc(p.x, p.y, 40, 0, 7); g.stroke();
      const bx = 1010 + (p.x - 1010) * k, by = 300 + (p.y - 300) * k - Math.sin(k * Math.PI) * 120;
      drawCentered(g, img(A(`images/characters/Mano/ManoGira0${1 + (Math.floor(this.t * 14) % 4)}.png`), true), bx, by, 0.4);
      text(g, '¡Agachate! (↓)', p.x, p.y - 90, { size: 26, align: 'center', color: '#fff', outline: '#a00', outlineW: 6 });
    }
    // Pi
    let pic = PI + 'Pi_00.png';
    if (this.st === 'idle' && this.fall > 0) pic = PI + `PiCae${String(Math.min(14, 1 + Math.floor((1.3 - this.fall) * 12))).padStart(2, '0')}.png`;
    else if ((this.st === 'hop' || this.st === 'fx') && this.hopT < 1) pic = PI + `Pi_Salto_0${this.hopT < 0.3 ? 0 : this.hopT < 0.75 ? 1 : 2}.png`;
    const sx = this.visual.x, sy = this.visual.y + (this.st === 'idle' && this.fall > 0 ? (1.3 - this.fall) * 160 : 0);
    drawFeet(g, img(pic, true), sx, sy + 26, 0.4, false);
    if (this.duck > 0) text(g, '⬇', sx, sy - 70, { size: 34, align: 'center', color: '#fff' });
    if (this.msgT > 0) text(g, this.msg, W / 2, H - 36, { size: 34, align: 'center', color: '#fff4c8', outline: '#000', outlineW: 8, alpha: Math.min(1, this.msgT) });
    text(g, `Casillero ${this.pos}/${END}`, W - 30, 120, { size: 28, align: 'right', color: '#fff', outline: '#000', outlineW: 6 });
  }
}
