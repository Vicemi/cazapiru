// Nivel 6 - ¡Sorpresa!… Olivera (final boss): three signs show numbers (e.g. 2 > 4 > 3). For each sign press Space that many times
// and then the arrow (→ / Enter / tap the arrow button). A complete combo hits Olivera; a wrong count or a slow combo makes him attack.
import { img } from '../core/assets';
import { playSound } from '../core/audio';
import { isPressed, pointer } from '../core/input';
import { A, FX, PI, PiraLevel, drawCentered, type PiraResult } from './base';
import { W, H } from '../core/app';
import { text } from '../ui/text';

const SIGN_X = [250, 540, 830];
const SIGN_Y = 300;
const HITS = 5;
const ARROW = { x: 130, y: 640, r: 62 };

type Phase = 'think' | 'strike' | 'hurt' | 'attack' | 'final';

export class Level6 extends PiraLevel {
  private seq: number[] = [];
  private cur = 0;
  private presses = 0;
  private timeLeft = 0;
  private st: Phase = 'think';
  private pt = 0;
  private broke = [false, false, false];
  private hp = HITS;
  private combo = 0;
  private msg = '';
  private msgT = 0;

  constructor(done: (r: PiraResult) => void) { super(6, done, 3); }

  protected assets() {
    const n = (i: number) => String(i).padStart(2, '0');
    return {
      keyed: [
        ...Array.from({ length: 6 }, (_, i) => A(`images/level6/carteles/CartelesRompen${n(i + 1)}.png`)), A('images/level6/arrow.png'),
        ...['A', 'B', 'C'].flatMap((s) => Array.from({ length: 6 }, (_, i) => A(`images/characters/Olivera/Olivera_${s}${n(i + 1)}.png`))),
        ...Array.from({ length: 8 }, (_, i) => PI + `PiGolpe${n(i + 1)}.png`), ...Array.from({ length: 13 }, (_, i) => PI + `PiGolpeFinal${n(i + 1 + (i >= 12 ? 1 : 0))}.png`),
        PI + 'Pi_00.png', PI + 'Pi_01.png', PI + 'PiGolpeado.png', PI + 'Pi_NO_00.png',
      ],
      plain: [A('images/level6/Fondos/Fondo_01.jpg')],
      sounds: ['Golpe_a_Olivera', 'Numero_Aparece', 'Olivera_Faja_carteles', 'Salto_Power'].map((s) => FX(`NIVEL_6/${s}.ogg`)),
    };
  }

  protected start(): void {
    this.hp = HITS; this.combo = 0;
    this.newSequence();
  }

  private say(s: string): void { this.msg = s; this.msgT = 2.4; }

  private newSequence(): void {
    const hard = HITS - this.hp;
    const max = 3 + Math.min(3, hard);
    this.seq = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * max));
    this.cur = 0; this.presses = 0; this.broke = [false, false, false];
    this.timeLeft = 9 + 4; this.st = 'think'; this.pt = 0;
    playSound(FX('NIVEL_6/Numero_Aparece.ogg'), 0.7);
  }

  protected tick(dt: number): void {
    if (this.msgT > 0) this.msgT -= dt;
    this.pt += dt;
    switch (this.st) {
      case 'think': {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.say('¡Muy lento!'); this.attack(); break; }
        if (isPressed('act')) { this.presses++; playSound(FX('NIVEL_6/Salto_Power.ogg'), 0.25); }
        const confirm = isPressed('right') || (pointer.pressed && Math.hypot(pointer.x - ARROW.x, pointer.y - ARROW.y) < ARROW.r + 14);
        if (confirm) this.confirmSign();
        break;
      }
      case 'strike':
        if (this.pt > 1.0) {
          this.hp--; this.combo++;
          this.addScore(100 + 25 * this.combo);
          playSound(FX('NIVEL_6/Golpe_a_Olivera.ogg'), 0.9);
          if (this.hp <= 0) { this.st = 'final'; this.pt = 0; } else { this.st = 'hurt'; this.pt = 0; }
        }
        break;
      case 'hurt':
        if (this.pt > 0.9) this.newSequence();
        break;
      case 'attack':
        if (this.pt > 1.0) {
          if (!this.loseLife()) this.newSequence();
        }
        break;
      case 'final':
        if (this.pt > 3.0) { this.addScore(Math.max(0, Math.round(600 - this.playT * 2))); this.finish(true); }
        break;
    }
  }

  private confirmSign(): void {
    if (this.presses === this.seq[this.cur]) {
      this.broke[this.cur] = true; this.cur++; this.presses = 0;
      playSound(FX('NIVEL_6/Olivera_Faja_carteles.ogg'), 0.5);
      if (this.cur >= 3) { this.st = 'strike'; this.pt = 0; this.say('¡Combo!'); }
    } else {
      this.say(`Era ${this.seq[this.cur]}, apretaste ${this.presses}`);
      this.attack();
    }
  }

  private attack(): void { this.st = 'attack'; this.pt = 0; this.combo = 0; playSound(FX('NIVEL_6/Olivera_Faja_carteles.ogg'), 0.8); }

  protected draw(g: CanvasRenderingContext2D): void {
    const bg = img(A('images/level6/Fondos/Fondo_01.jpg'));
    if (bg) g.drawImage(bg, 0, 0, W, H);
    // Olivera
    const hurt = this.st === 'hurt' || this.st === 'strike';
    const set = this.st === 'attack' ? 'B' : hurt ? 'C' : 'A';
    const frame = this.st === 'attack' ? 4 + (Math.floor(this.pt * 8) % 3) : 1 + (Math.floor(this.t * 3) % 3);
    const oli = img(A(`images/characters/Olivera/Olivera_${set}0${Math.min(6, frame)}.png`), true);
    const shake = hurt ? Math.sin(this.t * 60) * 6 : 0;
    if (this.st !== 'final') drawCentered(g, oli, 880 + shake, 640, this.st === 'attack' ? 1.05 + this.pt * 0.15 : 1);
    // Pi
    if (this.st === 'strike') {
      const f = Math.min(8, 1 + Math.floor(this.pt * 8));
      const im = img(PI + `PiGolpe0${f}.png`, true);
      if (im) g.drawImage(im, 60, 330, 1024 * 0.95, 512 * 0.95);
    } else if (this.st === 'final') {
      const f = Math.min(13, 1 + Math.floor(this.pt * 4.4));
      const idx = f >= 13 ? 14 : f;
      const im = img(PI + `PiGolpeFinal${String(idx).padStart(2, '0')}.png`, true);
      if (im) { const w = (im as HTMLCanvasElement).width, h = (im as HTMLCanvasElement).height; g.drawImage(im, 100, 120, w * 1.05, h * 1.05); }
    } else {
      const hit = this.st === 'attack' && this.pt > 0.5;
      drawCentered(g, img(PI + (hit ? 'PiGolpeado.png' : 'Pi_0' + (Math.floor(this.t * 2) % 2) + '.png'), true), 240, 700, 0.8, true);   // facing Olivera
    }
    // signs
    if (this.st === 'think' || this.st === 'attack') {
      const frame = (i: number) => (this.broke[i] ? 3 : 1);
      this.seq.forEach((n, i) => {
        const sx = SIGN_X[i];
        g.save();
        const active = i === this.cur && this.st === 'think';
        if (active) { g.shadowColor = '#ffd873'; g.shadowBlur = 26; }
        g.fillStyle = this.broke[i] ? 'rgba(160,100,40,0.35)' : '#d57d2a';
        g.strokeStyle = '#7a3e10'; g.lineWidth = 6;
        g.beginPath(); g.roundRect(sx - 90, SIGN_Y - 70, 180, 120, 14); g.fill(); g.stroke();
        g.fillStyle = '#7a3e10'; g.fillRect(sx - 8, SIGN_Y + 50, 16, 80);
        g.restore();
        if (!this.broke[i]) text(g, String(n), sx, SIGN_Y - 8, { size: 100, align: 'center', baseline: 'middle', color: '#fff', weight: 800, outline: '#7a3e10', outlineW: 12 });
        void frame;
        if (i < 2) text(g, '›', sx + 145, SIGN_Y - 8, { size: 70, align: 'center', baseline: 'middle', color: '#fff3c0', weight: 800 });
      });
      // press counter + arrow button
      text(g, `Espacio × ${this.presses}`, 540, 470, { size: 50, align: 'center', color: '#ffe9a8', weight: 800, outline: '#000', outlineW: 9 });
      const ar = img(A('images/level6/arrow.png'), true);
      drawCentered(g, ar, ARROW.x, ARROW.y, 1.9);
      text(g, 'Confirmar (→)', ARROW.x, ARROW.y + 108, { size: 26, align: 'center', color: '#fff', outline: '#000', outlineW: 6 });
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(300, 520, 480, 14);
      g.fillStyle = this.timeLeft > 4 ? '#6af09a' : '#ff6a5a'; g.fillRect(300, 520, 480 * Math.max(0, this.timeLeft / 13), 14);
    }
    // Olivera's life
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W / 2 - 220, 100, 440, 28);
    g.fillStyle = '#e04a3a'; g.fillRect(W / 2 - 216, 104, 432 * (this.hp / HITS), 20);
    text(g, 'Olivera', W / 2, 90, { size: 28, align: 'center', color: '#fff', outline: '#000', outlineW: 6 });
    if (this.combo > 1) text(g, `Combo ×${this.combo}`, W - 60, 200, { size: 44, align: 'right', color: '#ffd873', weight: 800, outline: '#000', outlineW: 8 });
    if (this.msgT > 0) text(g, this.msg, W / 2, H - 40, { size: 38, align: 'center', color: '#fff4c8', outline: '#000', outlineW: 8, alpha: Math.min(1, this.msgT) });
  }
}
