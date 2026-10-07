// Nivel 1 - ¡Rescate pirata!: Flo (guided by the pointer) carries each numbered key to the padlock with the same number.
// Beware the Z's of the snoring guard (click them or dodge them) and the swatting hand.
import { img } from '../core/assets';
import { playSound } from '../core/audio';
import { pointer } from '../core/input';
import { A, FLO, FX, PI, PiraLevel, drawCentered, type PiraResult } from './base';
import { W, H } from '../core/app';
import { text } from '../ui/text';

const STRIP = { x: 410, y: 24, scale: 1.45 };      // padlock strip (512x128 source, locks every ~44.6 px from x=54)
const SLOT0 = 54, SLOT_DX = 44.6;
const KEYS = 7;

interface Key { n: number; x: number; y: number; state: 'free' | 'carried' | 'used'; spawnT: number }
interface Zed { x: number; y: number; vx: number; vy: number; kind: number; t: number; col: string }

export class Level1 extends PiraLevel {
  private flo = { x: 600, y: 450, vx: 0, vy: 0, face: 1, stun: 0 };
  private keys: Key[] = [];
  private carry: Key | null = null;
  private opened = new Set<number>();
  private zs: Zed[] = [];
  private zT = 1.5;
  private hand: { x: number; y: number; t: number; dir: number } | null = null;
  private handT = 9;
  private no = 0;
  private msg = '';
  private msgT = 0;

  constructor(done: (r: PiraResult) => void) { super(1, done, 3); }

  protected assets() {
    const n = (i: number) => String(i).padStart(2, '0');
    return {
      keyed: [
        ...Array.from({ length: 10 }, (_, i) => A(`images/level1/Candados/Candados_${n(i + 1)}.png`)),
        A('images/level1/LLavesyNumeros/Llaves_01.png'), A('images/level1/LLavesyNumeros/Llaves_02.png'),
        ...Array.from({ length: 10 }, (_, i) => A(`images/level1/LLavesyNumeros/Numeros/Numeros_${n(i + 1)}.png`)),
        ...Array.from({ length: 6 }, (_, i) => A(`images/level1/Manos/Manos_${n(i)}.png`)),
        ...['01', '02', '03'].flatMap((k) => [A(`images/level1/Z/Z_${k}.png`), A(`images/level1/Z/Z_${k}_b.png`), A(`images/level1/Z/Z_${k}_c.png`)]),
        A('images/level1/PirataRonca/Pirata_Ronca_01.png'), A('images/level1/PirataRonca/Pirata_Ronca_02.png'),
        ...Array.from({ length: 5 }, (_, i) => FLO + `Loro_0${i + 1}.png`), ...Array.from({ length: 5 }, (_, i) => FLO + `Loro_0${i + 1}_Brillante.png`),
        FLO + 'Flo_NO_01.png', FLO + 'Flo_NO_02.png',
        ...Array.from({ length: 6 }, (_, i) => PI + `Pi_Hamaca_0${i}.png`), A('images/level1/Fondos/Fondo_02.png'),
      ],
      plain: [A('images/level1/Fondos/Fondo_01.jpg')],
      sounds: ['Aleteo', 'Dejar_LLave', 'NO', 'Pierde_Llave', 'Recoger_Llave', 'Ronquido', 'Ronquido_y_ZZZ'].map((s) => FX(`NIVEL_1/${s}.ogg`)),
    };
  }

  protected start(): void {
    this.keys = [];
    this.opened.clear();
    this.carry = null;
    this.zs = [];
    this.hand = null;
    this.handT = 8;
    this.flo = { x: 600, y: 450, vx: 0, vy: 0, face: 1, stun: 0 };
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - 0.5).slice(0, KEYS);
    const spots = [[200, 400], [420, 560], [660, 420], [330, 760], [640, 700], [860, 520], [120, 640], [520, 300], [900, 330]].sort(() => Math.random() - 0.5);
    nums.forEach((n, i) => this.keys.push({ n, x: spots[i][0], y: spots[i][1], state: 'free', spawnT: i * 0.12 }));
    this.say('Llevá cada llave a su candado');
  }

  private say(s: string): void { this.msg = s; this.msgT = 2.5; }

  private slotX(n: number): number { return STRIP.x + (SLOT0 + (n - 1) * SLOT_DX) * STRIP.scale; }
  private slotY(): number { return STRIP.y + 64 * STRIP.scale; }

  protected tick(dt: number): void {
    const f = this.flo;
    if (this.msgT > 0) this.msgT -= dt;
    if (this.no > 0) this.no -= dt;
    // follow the pointer with easing (the original: click-and-hold touchpad)
    if (f.stun > 0) f.stun -= dt;
    else if (pointer.inside) {
      const dx = pointer.x - f.x, dy = pointer.y - f.y;
      const k = 1 - Math.pow(0.002, dt);
      f.vx = dx * k / dt * 0.5; f.vy = dy * k / dt * 0.5;
      const sp = Math.hypot(f.vx, f.vy), max = 900;
      if (sp > max) { f.vx *= max / sp; f.vy *= max / sp; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (Math.abs(dx) > 8) f.face = dx > 0 ? 1 : -1;
    }
    f.x = Math.max(40, Math.min(W - 40, f.x)); f.y = Math.max(110, Math.min(H - 60, f.y));
    // pick up
    if (!this.carry && f.stun <= 0) {
      for (const k of this.keys) {
        if (k.state === 'free' && Math.hypot(k.x - f.x, k.y + 30 - f.y) < 62) {
          k.state = 'carried'; this.carry = k; playSound(FX('NIVEL_1/Recoger_Llave.ogg'), 0.7); this.say(`Llevá la llave ${k.n} al candado ${k.n}`);
          break;
        }
      }
    }
    // deliver
    if (this.carry) {
      const k = this.carry;
      for (let n = 1; n <= 10; n++) {
        if (this.opened.has(n)) continue;
        if (Math.hypot(this.slotX(n) - f.x, this.slotY() + 40 - f.y) < 54) {
          if (n === k.n) {
            k.state = 'used'; this.carry = null; this.opened.add(n); this.addScore(100); playSound(FX('NIVEL_1/Dejar_LLave.ogg'), 0.8);
            if (this.opened.size >= KEYS) { this.addScore(Math.max(0, Math.round(600 - this.playT * 5))); this.finish(true); }
          } else {
            // wrong padlock: Flo says NO and the key goes back to where it came from
            this.dropKey(true); playSound(FX('NIVEL_1/NO.ogg'), 0.8); this.no = 1;
            this.say(`Ese candado es el ${n}, no el ${k.n}`);
          }
          break;
        }
      }
    }
    // Z's from the snoring pirate
    this.zT -= dt;
    if (this.zT <= 0) {
      this.zT = 2.2 + Math.random() * 1.6;
      playSound(FX('NIVEL_1/Ronquido_y_ZZZ.ogg'), 0.4);
      const kind = Math.floor(Math.random() * 3);
      const ang = Math.PI * (0.85 + Math.random() * 0.45);
      this.zs.push({ x: 930, y: 700, vx: Math.cos(ang) * (110 + Math.random() * 90), vy: Math.sin(ang) * (110 + Math.random() * 90) * -1, kind, t: 0, col: ['', '_b', '_c'][Math.floor(Math.random() * 3)] });
    }
    for (const z of this.zs) {
      z.t += dt; z.x += z.vx * dt + Math.sin(z.t * 3) * 40 * dt; z.y += z.vy * dt;
      if (f.stun <= 0 && Math.hypot(z.x - f.x, z.y - f.y) < 44) { z.t = 99; this.hitFlo(); }
    }
    if (pointer.pressed) {
      for (const z of this.zs) if (Math.hypot(z.x - pointer.x, z.y - pointer.y) < 52) { z.t = 99; this.addScore(10); playSound(FX('NIVEL_1/Ronquido.ogg'), 0.4); }
    }
    this.zs = this.zs.filter((z) => z.t < 12 && z.x > -80 && z.y > -80);
    // the swatting hand
    this.handT -= dt;
    if (this.handT <= 0 && !this.hand) { this.hand = { x: W + 160, y: 250 + Math.random() * 450, t: 0, dir: -1 }; this.handT = 10 + Math.random() * 5; }
    if (this.hand) {
      const h = this.hand;
      h.t += dt;
      const warn = 1.0;
      if (h.t > warn) h.x -= 620 * dt;
      if (h.t > warn && f.stun <= 0 && Math.abs(h.x - f.x) < 120 && Math.abs(h.y - f.y) < 110) this.hitFlo();
      if (h.x < -260) this.hand = null;
    }
  }

  private dropKey(back: boolean): void {
    const k = this.carry;
    if (!k) return;
    k.state = 'free';
    if (back) { k.x = 140 + Math.random() * 700; k.y = 380 + Math.random() * 380; }
    else { k.x = this.flo.x; k.y = this.flo.y + 20; }
    this.carry = null;
  }

  private hitFlo(): void {
    this.flo.stun = 0.9;
    if (this.carry) { this.dropKey(false); playSound(FX('NIVEL_1/Pierde_Llave.ogg'), 0.8); this.say('¡Perdiste la llave!'); }
    this.addScore(-20);
    if (this.score < 0) this.score = 0;
  }

  protected draw(g: CanvasRenderingContext2D): void {
    const bg = img(A('images/level1/Fondos/Fondo_01.jpg'));
    if (bg) g.drawImage(bg, 0, 0, W, H);
    // Pi on the swing (animated hammock)
    const sw = Math.floor(this.t * 5) % 6;
    drawCentered(g, img(PI + `Pi_Hamaca_0${sw}.png`, true), 285, 120, 0.8);
    // padlocks
    const base = img(A('images/level1/Candados/Candados_10.png'), true);
    const sw0 = SLOT0 - SLOT_DX / 2;
    if (base) {
      for (let n = 1; n <= 10; n++) {
        const open = this.opened.has(n);
        // clip the slot from the strip whose gold padlock is (open ? this slot : another slot)
        const src = img(A(`images/level1/Candados/Candados_${String(open ? n : (n % 10) + 1).padStart(2, '0')}.png`), true);
        if (!src) continue;
        const sx = sw0 + (n - 1) * SLOT_DX;
        g.drawImage(src, sx, 0, SLOT_DX, 128, STRIP.x + sx * STRIP.scale, STRIP.y, SLOT_DX * STRIP.scale, 128 * STRIP.scale);
      }
    }
    // cage and guard
    const cage = img(A('images/level1/Fondos/Fondo_02.png'), true);
    const guard = img(A(`images/level1/PirataRonca/Pirata_Ronca_0${1 + (Math.floor(this.t * 1.2) % 2)}.png`), true);
    if (guard) drawCentered(g, guard, 930, 690, 0.7);
    if (cage) g.drawImage(cage, 754, 498, 446, 330, 754, 498, 446, 330);
    // keys
    for (const k of this.keys) {
      if (k.state !== 'free') continue;
      const bob = Math.sin(this.t * 3 + k.n) * 6;
      const im = img(A('images/level1/LLavesyNumeros/Llaves_0' + (k.n % 2 ? '1' : '2') + '.png'), true);
      drawCentered(g, im, k.x, k.y + bob, 0.7);
      drawCentered(g, img(A(`images/level1/LLavesyNumeros/Numeros/Numeros_${String(k.n).padStart(2, '0')}.png`), true), k.x, k.y - 30 + bob, 0.6);
    }
    // Z's
    for (const z of this.zs) {
      const im = img(A(`images/level1/Z/Z_0${z.kind + 1}${z.col}.png`), true);
      drawCentered(g, im, z.x, z.y, 0.9, false, Math.min(1, 12 - z.t));
    }
    // hand
    if (this.hand) {
      const h = this.hand;
      const warn = h.t < 1;
      const frame = Math.min(5, Math.floor(h.t * 5));
      const im = img(A(`images/level1/Manos/Manos_0${warn ? Math.min(2, frame) : 5 - (frame % 3)}.png`), true);
      if (warn) { g.fillStyle = 'rgba(255,60,40,0.25)'; g.fillRect(W - 90, h.y - 90, 90, 180); text(g, '!', W - 40, h.y + 20, { size: 70, align: 'center', color: '#ff4030', weight: 800 }); }
      else drawCentered(g, im, h.x, h.y, 0.9, true);
    }
    // Flo
    const f = this.flo;
    const frame = 1 + (Math.floor(this.t * 12) % 5);
    const stunned = f.stun > 0;
    const im = this.no > 0 || stunned ? img(FLO + `Flo_NO_0${1 + (Math.floor(this.t * 8) % 2)}.png`, true) : img(FLO + `Loro_0${frame}${this.carry ? '_Brillante' : ''}.png`, true);
    if (this.carry) {
      const kim = img(A('images/level1/LLavesyNumeros/Llaves_0' + (this.carry.n % 2 ? '1' : '2') + '.png'), true);
      drawCentered(g, kim, f.x - 6 * f.face, f.y + 54, 0.62);
      drawCentered(g, img(A(`images/level1/LLavesyNumeros/Numeros/Numeros_${String(this.carry.n).padStart(2, '0')}.png`), true), f.x - 6 * f.face, f.y + 26, 0.5);
    }
    drawCentered(g, im, f.x, f.y, 0.85, f.face > 0);   // Flo's frames face left
    if (this.msgT > 0) text(g, this.msg, W / 2, H - 40, { size: 36, align: 'center', color: '#fff4c8', outline: '#000', outlineW: 8, alpha: Math.min(1, this.msgT) });
    void FLO;
  }
}
