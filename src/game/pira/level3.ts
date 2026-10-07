// Nivel 3 - ¡Todos a bordo!: Pi loads exactly as many crates as the orange floor number says (Space at the pile), carries them to the
// ship and stacks them one by one (Space) to build a staircase. Jump (Up) over the rolling barrels.
import { img } from '../core/assets';
import { playSound } from '../core/audio';
import { isDown, isPressed } from '../core/input';
import { A, FLO, FX, PI, PiraLevel, drawCentered, drawFeet, type PiraResult } from './base';
import { W, H } from '../core/app';
import { text } from '../ui/text';

const GROUND = 805;
const STAGES = 5;
const LOAD_X = [60, 330];
const DROP_X = [700, 960];
const COL_X = (c: number) => 760 + c * 78;

interface Barrel { x: number; rot: number; hit: boolean }

export class Level3 extends PiraLevel {
  private px = 200;
  private py = 0;           // height above ground
  private vy = 0;
  private face = 1;
  private load = 0;
  private stage = 1;
  private dropped = 0;      // crates dropped in the current stage
  private cols: number[] = [];
  private barrels: Barrel[] = [];
  private bT = 3;
  private stun = 0;
  private msg = '';
  private msgT = 0;
  private walkT = 0;

  constructor(done: (r: PiraResult) => void) { super(3, done, 3); }

  protected assets() {
    const n = (i: number) => String(i).padStart(2, '0');
    return {
      keyed: [
        A('images/level3/cajon.png'), A('images/level3/barril.png'), A('images/level3/Balloon_Flo.png'),
        ...Array.from({ length: 10 }, (_, i) => A(`images/level3/White/N_Blancos_${n(i + 1)}.png`)),
        ...Array.from({ length: 10 }, (_, i) => A(`images/level3/Orange/N_Naranja_${n(i + 1)}.png`)),
        ...Array.from({ length: 8 }, (_, i) => PI + `Pi_Caminar_0${i}.png`), ...Array.from({ length: 8 }, (_, i) => PI + `Pi_Caminar_CC_0${i}.png`),
        PI + 'Pi_00.png', PI + 'Pi_Cargar_00.png', PI + 'Pi_Cargar_01.png', PI + 'Pi_Cargando_00.png', PI + 'Pi_Salto_00.png', PI + 'Pi_Salto_01.png', PI + 'Pi_Salto_02.png', PI + 'PiGolpeado.png',
        ...Array.from({ length: 5 }, (_, i) => FLO + `Loro_0${i + 1}.png`),
      ],
      plain: [A('images/level3/Fondos/Fondo_01.jpg'), 'caza/objects/npc004_maximus/images/npc004_maximus_default_default_w001.png'],
      sounds: ['Carga_un_Objeto', 'Dejar_Caja', 'Ruido_Golpe', 'Tirar_Barril'].map((s) => FX(`NIVEL_3/${s}.ogg`)),
    };
  }

  protected start(): void {
    this.px = 220; this.py = 0; this.vy = 0; this.load = 0; this.stage = 1; this.dropped = 0; this.cols = Array(STAGES).fill(0);
    this.barrels = []; this.bT = 4; this.stun = 0;
    this.say('Cargá tantos cajones como diga el número naranja');
  }
  private say(s: string): void { this.msg = s; this.msgT = 3; }

  private inLoad(): boolean { return this.px >= LOAD_X[0] && this.px <= LOAD_X[1]; }
  private inDrop(): boolean { return this.px >= DROP_X[0] && this.px <= DROP_X[1]; }

  protected tick(dt: number): void {
    if (this.msgT > 0) this.msgT -= dt;
    if (this.stun > 0) this.stun -= dt;
    const dir = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
    if (this.stun <= 0) {
      const sp = this.load > 0 ? 190 : 250;
      this.px = Math.max(40, Math.min(1010, this.px + dir * sp * dt));
      if (dir) { this.face = dir; this.walkT += dt; }
      if (isPressed('up') && this.py === 0) { this.vy = 640; }
      if (isPressed('act')) this.action();
    }
    if (this.py > 0 || this.vy > 0) { this.vy -= 1900 * dt; this.py = Math.max(0, this.py + this.vy * dt); if (this.py === 0) this.vy = 0; }
    // barrels roll along the dock
    this.bT -= dt;
    if (this.bT <= 0) { this.bT = 4.5 + Math.random() * 2.5; this.barrels.push({ x: W + 80, rot: 0, hit: false }); playSound(FX('NIVEL_3/Tirar_Barril.ogg'), 0.6); }
    for (const b of this.barrels) {
      b.x -= 330 * dt; b.rot -= dt * 6;
      if (!b.hit && this.stun <= 0 && Math.abs(b.x - this.px) < 52 && this.py < 70) { b.hit = true; this.hitByBarrel(); }
    }
    this.barrels = this.barrels.filter((b) => b.x > -100);
  }

  private action(): void {
    if (this.inLoad() && this.py === 0) {
      if (this.load < 9) { this.load++; playSound(FX('NIVEL_3/Carga_un_Objeto.ogg'), 0.7); }
    } else if (this.inDrop() && this.load > 0) {
      this.load--; this.dropped++; this.cols[this.stage - 1]++;
      playSound(FX('NIVEL_3/Dejar_Caja.ogg'), 0.8);
      if (this.dropped > this.stage) {
        // too many: the column collapses
        this.cols[this.stage - 1] = 0; this.dropped = 0; this.load = 0; this.say(`¡Eran ${this.stage} cajones! Se cayó la pila`);
        playSound(FX('NIVEL_3/Ruido_Golpe.ogg'), 0.6);
        if (this.loseLife()) return;
      } else if (this.dropped === this.stage && this.load === 0) {
        this.addScore(80 * this.stage);
        this.stage++; this.dropped = 0;
        if (this.stage > STAGES) { this.addScore(Math.max(0, Math.round(500 - this.playT * 3))); this.finish(true); }
        else this.say(`¡Bien! Ahora ${this.stage} cajones`);
      } else if (this.load === 0 && this.dropped < this.stage) {
        this.say(`Faltan ${this.stage - this.dropped}: volvé a cargar`);
      }
    }
  }

  private hitByBarrel(): void {
    playSound(FX('NIVEL_3/Ruido_Golpe.ogg'), 0.8);
    this.stun = 1.2;
    if (this.load > 0) { this.say('¡El barril te hizo perder los cajones!'); this.load = 0; }
    this.cols[this.stage - 1] = Math.max(0, this.cols[this.stage - 1] - this.dropped);
    this.dropped = 0;
    this.loseLife();
  }

  protected draw(g: CanvasRenderingContext2D): void {
    const bg = img(A('images/level3/Fondos/Fondo_01.jpg'));
    if (bg) g.drawImage(bg, 0, 0, W, H);
    const crate = img(A('images/level3/cajon.png'), true);
    // pile of crates (load zone)
    for (let i = 0; i < 6; i++) drawFeet(g, crate, 120 + (i % 3) * 74, GROUND - 4 - Math.floor(i / 3) * 62, 0.9);
    // staircase being built
    for (let c = 0; c < STAGES; c++) for (let h = 0; h < this.cols[c]; h++) drawFeet(g, crate, COL_X(c) + 40, GROUND - 4 - h * 58, 0.9);
    // floor numbers: white = done, orange = current
    const n2 = (i: number) => String(i).padStart(2, '0');
    for (let k = 1; k <= STAGES; k++) {
      const im = k < this.stage ? img(A(`images/level3/White/N_Blancos_${n2(k)}.png`), true) : k === this.stage ? img(A(`images/level3/Orange/N_Naranja_${n2(k)}.png`), true) : null;
      drawCentered(g, im, COL_X(k - 1) + 36, GROUND + 46, 0.8);
    }
    // Máximus, the Academy bully, throws the barrels from the dock's edge
    drawFeet(g, img('caza/objects/npc004_maximus/images/npc004_maximus_default_default_w001.png'), W - 70, GROUND + 18, 1.5);
    // barrels
    const bar = img(A('images/level3/barril.png'), true);
    for (const b of this.barrels) {
      g.save(); g.translate(b.x, GROUND - 40); g.rotate(b.rot);
      if (bar) g.drawImage(bar, -50, -50, 100, 100);
      g.restore();
    }
    // Pi
    const carrying = this.load > 0;
    let pic = PI + 'Pi_00.png';
    if (this.stun > 0) pic = PI + 'PiGolpeado.png';
    else if (this.py > 0) pic = PI + `Pi_Salto_0${this.vy > 200 ? 0 : this.vy > -200 ? 1 : 2}.png`;
    else if (isDown('left') || isDown('right')) pic = PI + `Pi_Caminar${carrying ? '_CC' : ''}_0${Math.floor(this.walkT * 11) % 8}.png`;
    else if (carrying) pic = PI + 'Pi_Cargando_00.png';
    drawFeet(g, img(pic, true), this.px, GROUND + 14 - this.py, 0.8, this.face > 0);   // Pi's frames face left
    // crates carried (stacked on Pi's head)
    for (let i = 0; i < this.load; i++) drawFeet(g, crate, this.px, GROUND - 128 - this.py - i * 30, 0.55);
    // Flo with the counter balloon
    const balloon = img(A('images/level3/Balloon_Flo.png'), true);
    const fx = this.px - 80 * this.face, fy = GROUND - 270 - this.py + Math.sin(this.t * 4) * 6;
    drawCentered(g, img(FLO + `Loro_0${1 + (Math.floor(this.t * 12) % 5)}.png`, true), fx, fy, 0.5, this.face > 0);
    if (carrying) {
      drawCentered(g, balloon, fx + 46, fy - 52, 0.42);
      text(g, String(this.load), fx + 46, fy - 48, { size: 34, align: 'center', baseline: 'middle', color: '#fff', weight: 800 });
    }
    // zone hints
    if (this.inLoad() && !carrying) text(g, 'Espacio: cargar cajón', this.px, GROUND - 190, { size: 26, align: 'center', color: '#fff', outline: '#000', outlineW: 6 });
    if (this.inDrop() && carrying) text(g, 'Espacio: apilar', this.px, GROUND - 190, { size: 26, align: 'center', color: '#fff', outline: '#000', outlineW: 6 });
    text(g, `Escalón ${Math.min(this.stage, STAGES)}/${STAGES}: ${this.stage} cajones`, W / 2 + 130, 80, { size: 40, align: 'center', color: '#ffe9a8', weight: 800, outline: '#000', outlineW: 8 });
    if (this.msgT > 0) text(g, this.msg, W / 2, H - 36, { size: 34, align: 'center', color: '#fff4c8', outline: '#000', outlineW: 8, alpha: Math.min(1, this.msgT) });
  }
}
