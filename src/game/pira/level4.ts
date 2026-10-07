// Nivel 4 - Un bucanero sin buque: in the dark hold Pi (arrows + Space) fetches the objects Flo asks for (card on the board) and
// hands them to Flo's ladder. The lights go out from time to time: only a circle around Pi is visible.
import { img } from '../core/assets';
import { playSound } from '../core/audio';
import { isDown, isPressed } from '../core/input';
import { A, FLO, FX, PI, PiraLevel, drawCentered, drawFeet, type PiraResult } from './base';
import { W, H } from '../core/app';
import { text } from '../ui/text';

type Kind = 'canon' | 'tabla' | 'caja' | 'cuerda' | 'dinamita' | 'barril' | 'bala' | 'arpon';
const OBJ: Record<Kind, { pic: string; card: string; max: number; label: string; w: number }> = {
  canon: { pic: 'Objetos/cannon.png', card: 'canon', max: 3, label: 'cañón', w: 54 },
  tabla: { pic: 'Objetos/tablasA_01.png', card: 'tabla', max: 5, label: 'tabla', w: 90 },
  caja: { pic: 'Objetos/cajasA_01.png', card: 'caja', max: 4, label: 'caja', w: 70 },
  cuerda: { pic: 'Objetos/cuerdasA_01.png', card: 'cuerda', max: 4, label: 'cuerda', w: 80 },
  dinamita: { pic: 'Objetos/dinamitaA_01.png', card: 'dinamita', max: 4, label: 'dinamita', w: 80 },
  barril: { pic: 'Objetos/barrilesA_01.png', card: 'barril', max: 3, label: 'barril', w: 76 },
  bala: { pic: 'Objetos/balasA_01.png', card: 'bala', max: 6, label: 'bala', w: 70 },
  arpon: { pic: 'Objetos/arponesA_01.png', card: 'arpon', max: 4, label: 'arpón', w: 90 },
};
const KINDS = Object.keys(OBJ) as Kind[];
const FLOOR = { x0: 90, x1: 1110, y0: 520, y1: 860 };
const LADDER = { x: 860, y: 520 };

interface Pile { kind: Kind; x: number; y: number; left: number }

export class Level4 extends PiraLevel {
  private px = 300;
  private py = 700;
  private face = 1;
  private walkT = 0;
  private piles: Pile[] = [];
  private carry: Kind | null = null;
  private stage = 0;
  private need: { kind: Kind; left: number }[] = [];
  private lights = true;
  private lT = 12;
  private msg = '';
  private msgT = 0;
  private total = 4;

  constructor(done: (r: PiraResult) => void) { super(4, done, 3); }

  protected assets() {
    const cards = KINDS.flatMap((k) => Array.from({ length: OBJ[k].max + 1 }, (_, i) => A(`images/level4/interface_items/${OBJ[k].card}${String(i).padStart(2, '0')}.png`)));
    return {
      keyed: [
        ...KINDS.map((k) => A('images/level4/' + OBJ[k].pic)), ...cards,
        ...Array.from({ length: 8 }, (_, i) => PI + `Pi_Caminar_0${i}.png`), ...Array.from({ length: 8 }, (_, i) => PI + `Pi_Caminar_CC_0${i}.png`),
        PI + 'Pi_00.png', PI + 'Pi_Cargando_00.png', PI + 'Pi_NO_00.png', PI + 'Pi_NO_01.png', PI + 'Pi_NO_02.png',
        ...Array.from({ length: 5 }, (_, i) => FLO + `Loro_0${i + 1}.png`),
      ],
      plain: [A('images/level4/Fondos/Fondo_01.jpg'), 'caza/objects/npc003_jocosius/images/npc003_jocosius_default.png'],
      sounds: ['Entregar_objeto', 'luzA', 'luzB', 'Recoger_Objeto'].map((s) => FX(`NIVEL_4/${s}.ogg`)),
    };
  }

  protected start(): void {
    this.px = 300; this.py = 700; this.carry = null; this.stage = 0; this.lights = true; this.lT = 12;
    // eight piles at fixed-ish spots, one kind each (shuffled)
    const spots = [[160, 600], [430, 560], [650, 640], [980, 650], [250, 820], [560, 830], [830, 800], [1060, 840]];
    const kinds = [...KINDS].sort(() => Math.random() - 0.5);
    this.piles = spots.map((s, i) => ({ kind: kinds[i], x: s[0], y: s[1], left: 6 }));
    this.newRequest();
    this.say('Mirá lo que pide Flo y traelo hasta la escalera');
  }
  private say(s: string): void { this.msg = s; this.msgT = 3; }

  private newRequest(): void {
    const n = this.stage < 2 ? 1 : 2;
    const ks = [...KINDS].sort(() => Math.random() - 0.5).slice(0, n);
    this.need = ks.map((k) => ({ kind: k, left: 1 + Math.floor(Math.random() * Math.min(3, OBJ[k].max)) }));
  }

  protected tick(dt: number): void {
    if (this.msgT > 0) this.msgT -= dt;
    // lights
    this.lT -= dt;
    if (this.lT <= 0) {
      this.lights = !this.lights;
      this.lT = this.lights ? 12 + Math.random() * 6 : 4 + Math.random() * 2;
      playSound(FX(this.lights ? 'NIVEL_4/luzB.ogg' : 'NIVEL_4/luzA.ogg'), 0.6);
    }
    const dx = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0), dy = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    const sp = this.carry ? 200 : 250;
    this.px = Math.max(FLOOR.x0, Math.min(FLOOR.x1, this.px + (dx / len) * sp * dt));
    this.py = Math.max(FLOOR.y0, Math.min(FLOOR.y1, this.py + (dy / len) * sp * dt));
    if (dx) this.face = dx;
    if (dx || dy) this.walkT += dt;
    if (isPressed('act')) this.action();
  }

  private action(): void {
    const nearLadder = Math.hypot(this.px - LADDER.x, this.py - (LADDER.y + 50)) < 130;
    if (this.carry) {
      if (nearLadder) { this.deliver(); return; }
    } else {
      let best: Pile | null = null, bd = 90;
      for (const p of this.piles) { const d = Math.hypot(p.x - this.px, p.y - this.py); if (p.left > 0 && d < bd) { bd = d; best = p; } }
      if (best) { best.left--; this.carry = best.kind; playSound(FX('NIVEL_4/Recoger_Objeto.ogg'), 0.7); }
    }
  }

  private deliver(): void {
    const k = this.carry!;
    const n = this.need.find((x) => x.kind === k && x.left > 0);
    this.carry = null;
    if (!n) {
      this.say(`Flo no pidió ${OBJ[k].label}…`);
      this.addScore(-25); if (this.score < 0) this.score = 0;
      this.loseLife();
      return;
    }
    n.left--;
    this.addScore(30);
    playSound(FX('NIVEL_4/Entregar_objeto.ogg'), 0.8);
    if (this.need.every((x) => x.left <= 0)) {
      this.stage++;
      this.addScore(100);
      if (this.stage >= this.total) { this.addScore(Math.max(0, Math.round(400 - this.playT * 2))); this.finish(true); }
      else { this.newRequest(); this.say('¡Eso es! Nueva lista de Flo'); }
    }
  }

  /** feet-anchored object; the cannon picture carries a white margin on the right that is cropped out */
  private sprite(g: CanvasRenderingContext2D, im: CanvasImageSource, kind: Kind, x: number, y: number, s: number): void {
    const c = im as HTMLCanvasElement;
    const sw = kind === 'canon' ? Math.round(c.width * 0.74) : c.width;
    g.drawImage(im, 0, 0, sw, c.height, x - sw * s / 2, y - c.height * s, sw * s, c.height * s);
  }

  protected draw(g: CanvasRenderingContext2D): void {
    const bg = img(A('images/level4/Fondos/Fondo_01.jpg'));
    if (bg) g.drawImage(bg, 0, 0, W, H);
    // sorted by y: piles and Pi
    const items: { y: number; draw: () => void }[] = [];
    for (const p of this.piles) {
      if (p.left <= 0) continue;
      items.push({ y: p.y, draw: () => {
        const im = img(A('images/level4/' + OBJ[p.kind].pic), true);
        const w = (im as HTMLCanvasElement | null)?.width ?? 0;
        if (im && w) { const s = OBJ[p.kind].w * 1.5 / w; for (let i = 0; i < Math.min(3, p.left); i++) this.sprite(g, im, p.kind, p.x + i * 14 - 14, p.y - i * 6, s); }
      } });
    }
    items.push({ y: this.py, draw: () => {
      let pic = PI + 'Pi_00.png';
      if (isDown('left') || isDown('right') || isDown('up') || isDown('down')) pic = PI + `Pi_Caminar${this.carry ? '_CC' : ''}_0${Math.floor(this.walkT * 11) % 8}.png`;
      else if (this.carry) pic = PI + 'Pi_Cargando_00.png';
      drawFeet(g, img(pic, true), this.px, this.py + 14, 0.5, this.face > 0);   // Pi's frames face left
      if (this.carry) {
        const im = img(A('images/level4/' + OBJ[this.carry].pic), true);
        const w = (im as HTMLCanvasElement | null)?.width ?? 1;
        if (im) this.sprite(g, im, this.carry, this.px, this.py - 82, OBJ[this.carry].w * 1.1 / w);
      }
    } });
    items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
    // Jocosius sweeping the hold
    drawFeet(g, img('caza/objects/npc003_jocosius/images/npc003_jocosius_default.png'), 60, 880 + Math.sin(this.t * 3) * 2, 1.3);
    // Flo and the card on the board
    drawCentered(g, img(FLO + `Loro_0${1 + (Math.floor(this.t * 12) % 5)}.png`, true), 905, 330 + Math.sin(this.t * 4) * 5, 0.8);
    this.need.forEach((n, i) => {
      const card = img(A(`images/level4/interface_items/${OBJ[n.kind].card}${String(Math.max(0, n.left)).padStart(2, '0')}.png`), true);
      if (card) g.drawImage(card, 1008 + i * 66, 150, 64, 128);
    });
    text(g, `Lista ${this.stage + 1}/${this.total}`, 1040, 300, { size: 26, align: 'center', color: '#fff', outline: '#000', outlineW: 6 });
    // darkness
    if (!this.lights) {
      g.save();
      const k = Math.min(1, (1 - Math.max(0, this.lT - 3.5)) || 1);
      g.fillStyle = `rgba(0,0,6,0.93)`;
      g.beginPath(); g.rect(0, 0, W, H); g.arc(this.px, this.py - 50, 150, 0, Math.PI * 2, true); g.fill('evenodd');
      const rg = g.createRadialGradient(this.px, this.py - 50, 110, this.px, this.py - 50, 170);
      rg.addColorStop(0, 'rgba(0,0,6,0)'); rg.addColorStop(1, 'rgba(0,0,6,0.93)');
      g.fillStyle = rg; g.beginPath(); g.arc(this.px, this.py - 50, 170, 0, 7); g.fill();
      g.restore();
      void k;
      text(g, '¡Se apagaron las luces!', W / 2, 140, { size: 38, align: 'center', color: '#ffe9a8', outline: '#000', outlineW: 8 });
    }
    if (!this.carry && this.msgT <= 0) text(g, 'Espacio: agarrar (cerca de un montón) / entregar (cerca de la escalera)', W / 2, H - 36, { size: 26, align: 'center', color: '#fff', outline: '#000', outlineW: 6 });
    if (this.msgT > 0) text(g, this.msg, W / 2, H - 36, { size: 34, align: 'center', color: '#fff4c8', outline: '#000', outlineW: 8, alpha: Math.min(1, this.msgT) });
  }
}
