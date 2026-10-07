// Main menu in the style of Cazaproblemas (parchment, sprite buttons with normal/over/press states), extended with Piracálculos:
// new game -> school year (5/6) -> choose Aki or Pi.  Everything is laid out in the original 600x450 space and drawn at 2x.
import { App, W, H, roundRect, type Scene } from '../core/app';
import { img } from '../core/assets';
import { playMusic, playSound, isMusicOn, isSoundOn, setMusicEnabled, setSoundEnabled } from '../core/audio';
import { isPressed, pointer } from '../core/input';
import { text, paragraph } from '../ui/text';
import { ribbon } from '../ui/fx';
import { pixText } from '../ui/pixfont';
import { outfitFor } from '../story/skins';
import { commit, hasSave, newGame, resume, save } from '../save';
import { startHero } from './flow';

const S = 2;
const MUSIC = 'caza/music/maintheme.ogg';
const MENU = 'caza/screens/menus/';
const click = () => playSound('caza/sounds/general/btn_press.ogg', 0.6);

/** Night sky of Terragrifus: Serélia (big, white) and Syrëlia (small, blue, half hidden behind it). */
export function drawSky(g: CanvasRenderingContext2D, t: number, moons = true): void {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#070b24'); gr.addColorStop(0.45, '#18214e'); gr.addColorStop(0.8, '#3c3a6e'); gr.addColorStop(1, '#6e4a72');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // a soft band of nebula across the sky
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [cx, cy, r, c] of [[260, 260, 300, '90,70,160'], [620, 180, 260, '60,90,170'], [1000, 330, 280, '120,60,140']] as [number, number, number, string][]) {
    const ng = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    ng.addColorStop(0, `rgba(${c},0.16)`); ng.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = ng; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g.restore();
  // round stars of different sizes; a few twinkle with a cross
  for (let i = 0; i < 120; i++) {
    const x = (i * 197 + 31) % W, y = (i * 83 + 11) % (H * 0.68);
    const size = i % 9 === 0 ? 2.2 : i % 3 === 0 ? 1.5 : 1;
    const a = 0.35 + 0.55 * Math.abs(Math.sin(t * (0.5 + (i % 5) * 0.2) + i));
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
    if (i % 17 === 0) {
      g.strokeStyle = `rgba(255,255,255,${a * 0.6})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke();
    }
  }
  if (moons) drawMoons(g, 900, 190, 1);
}

/** Serélia (big, white, lit from the upper left) with Syrëlia (small, blue) half hidden behind it (or apart), at (x, y) with a uniform scale. */
export function drawMoons(g: CanvasRenderingContext2D, x: number, y: number, s: number, apart = false): void {
  g.save(); g.translate(x, y); g.scale(s, s);
  // apart: before the catapult hid it, Syrëlia shone on its own to the right
  const R = 128, bx = apart ? 300 : -92, by = apart ? 70 : 64, br = 54;
  // soft halos (radial gradients, not flat discs)
  const hb = g.createRadialGradient(bx, by, br * 0.6, bx, by, br * 2.1);
  hb.addColorStop(0, 'rgba(90,170,255,0.45)'); hb.addColorStop(1, 'rgba(90,170,255,0)');
  g.fillStyle = hb; g.beginPath(); g.arc(bx, by, br * 2.1, 0, Math.PI * 2); g.fill();
  const hw = g.createRadialGradient(0, 0, R * 0.8, 0, 0, R * 1.9);
  hw.addColorStop(0, 'rgba(225,232,255,0.35)'); hw.addColorStop(1, 'rgba(225,232,255,0)');
  g.fillStyle = hw; g.beginPath(); g.arc(0, 0, R * 1.9, 0, Math.PI * 2); g.fill();
  // Syrëlia, the blue moon
  const bg = g.createRadialGradient(bx - 18, by - 18, 4, bx, by, br);
  bg.addColorStop(0, '#bfe6ff'); bg.addColorStop(0.45, '#5ab0ff'); bg.addColorStop(1, '#1d4fa8');
  g.fillStyle = bg; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
  // Serélia, the white moon: shaded sphere, craters with a lit rim, darker terminator on the lower right
  const wg = g.createRadialGradient(-40, -44, 8, 0, 0, R);
  wg.addColorStop(0, '#ffffff'); wg.addColorStop(0.6, '#e4e9f7'); wg.addColorStop(1, '#a9b2d4');
  g.fillStyle = wg; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.clip();
  for (const [dx, dy, r] of [[-46, -22, 24], [30, 20, 31], [-6, 58, 15], [52, -50, 12], [-70, 40, 10], [70, 64, 9]] as [number, number, number][]) {
    const cg = g.createRadialGradient(dx + r * 0.3, dy + r * 0.3, 1, dx, dy, r);
    cg.addColorStop(0, 'rgba(150,160,200,0.55)'); cg.addColorStop(1, 'rgba(150,160,200,0.18)');
    g.fillStyle = cg; g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
    g.beginPath(); g.arc(dx, dy, r, Math.PI * 0.15, Math.PI * 0.95); g.stroke();
  }
  const term = g.createLinearGradient(-R, -R, R, R);
  term.addColorStop(0.55, 'rgba(40,50,100,0)'); term.addColorStop(1, 'rgba(40,50,100,0.35)');
  g.fillStyle = term; g.fillRect(-R, -R, R * 2, R * 2);
  g.restore();
  g.restore();
}
export function drawShip(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.save(); g.translate(x, y); g.scale(s, s);
  // hull with a curved keel
  const hull = g.createLinearGradient(0, -10, 0, 60); hull.addColorStop(0, '#3a2234'); hull.addColorStop(1, '#140a16');
  g.fillStyle = hull;
  g.beginPath(); g.moveTo(-140, -6); g.lineTo(150, -14); g.quadraticCurveTo(130, 40, 70, 54); g.lineTo(-90, 54); g.quadraticCurveTo(-130, 30, -140, -6); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,210,120,0.55)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-70 + i * 40, 18, 5, 0, Math.PI * 2); g.fill(); }
  // masts and sails
  g.fillStyle = '#1a1020'; g.fillRect(-36, -190, 7, 186); g.fillRect(58, -150, 6, 140);
  const sail = (sx: number, top: number, w: number, h: number): void => {
    const sg = g.createLinearGradient(sx - w / 2, 0, sx + w / 2, 0); sg.addColorStop(0, '#d8cfb8'); sg.addColorStop(1, '#9e9480');
    g.fillStyle = sg;
    g.beginPath(); g.moveTo(sx - w / 2, top); g.quadraticCurveTo(sx, top + 10, sx + w / 2, top); g.quadraticCurveTo(sx + w / 2 + 14, top + h / 2, sx + w / 2, top + h);
    g.quadraticCurveTo(sx, top + h + 10, sx - w / 2, top + h); g.quadraticCurveTo(sx - w / 2 + 14, top + h / 2, sx - w / 2, top); g.fill();
  };
  sail(-32, -176, 110, 70); sail(-32, -96, 130, 76); sail(61, -136, 86, 100);
  // flag
  g.fillStyle = '#111'; g.beginPath(); g.moveTo(-29, -190); g.lineTo(14, -182); g.lineTo(-29, -168); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-18, -180, 3.5, 0, Math.PI * 2); g.fill();
  g.restore();
}

type Mode = 'main' | 'year' | 'hero' | 'options' | 'confirm' | 'credits';

interface MenuItem { id: string; sprite: string; w: number; h: number; disabled?: boolean }

/** Parchment panel (both games use warm paper for their menus). */
function parchment(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 28; g.shadowOffsetY = 10;
  roundRect(g, x, y, w, h, 26);
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#fbefc9'); gr.addColorStop(1, '#e8cd92');
  g.fillStyle = gr; g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 6; g.strokeStyle = '#5a3416'; g.stroke();
  roundRect(g, x + 12, y + 12, w - 24, h - 24, 18);
  g.setLineDash([10, 8]); g.lineWidth = 2; g.strokeStyle = 'rgba(122,74,34,0.55)'; g.stroke();
  g.restore();
}

export class TitleScene implements Scene {
  private mode: Mode = 'main';
  private t = 0;
  private year = 5;
  private sel = 0;
  private page = 0;
  /** selection inside the modal windows (year / options / confirm) */
  private msel = 0;
  private heroSince = 0;
  /** the pointer only changes the selection when it moves (keyboard and mouse no longer fight) */
  private lastPtr = { x: -1, y: -1 };
  private ptrMoved = false;
  private items: MenuItem[] = [];

  enter(app: App): void {
    app.state.scene = 'title';
    app.state.touch = 'none';
    playMusic(MUSIC);
    this.items = [
      { id: 'continue', sprite: 'btn_continue', w: 143, h: 39, disabled: !hasSave() },
      { id: 'new', sprite: 'btn_newgame', w: 183, h: 43 },
      { id: 'options', sprite: 'btn_options', w: 123, h: 38 },
      { id: 'credits', sprite: 'btn_credits', w: 120, h: 37 },
    ];
    this.sel = hasSave() ? 0 : 1;
  }

  update(dt: number, app: App): void {
    this.t += dt;
    if (this.mode === 'main') {
      const n = this.items.length;
      const step = (d: number): void => {
        let k = this.sel;
        for (let i = 0; i < n; i++) { k = (k + d + n) % n; if (!this.items[k].disabled) break; }
        this.sel = k;
        playSound('caza/sounds/general/btn_over.ogg', 0.4);
      };
      if (isPressed('up')) step(-1);
      if (isPressed('down')) step(1);
      if (isPressed('act')) this.menu(app, this.items[this.sel].id);
    } else if (this.mode === 'hero') {
      if (isPressed('left')) this.sel = 0;
      if (isPressed('right')) this.sel = 1;
      // ignore the key press that opened the picker (it used to confirm Aki instantly)
      if (isPressed('act') && this.t - this.heroSince > 0.25) this.pickHero(app, this.sel === 0 ? 'aki' : 'pi');
    } else if (this.mode === 'year' || this.mode === 'confirm' || this.mode === 'options') {
      if (isPressed('left')) this.msel = 0;
      if (isPressed('right')) this.msel = 1;
      if (isPressed('act')) this.modalPick(this.msel);
    }
    if (isPressed('back') && this.mode !== 'main') { this.mode = 'main'; this.page = 0; this.sel = hasSave() ? 0 : 1; }
  }

  private pickHero(app: App, hero: 'aki' | 'pi'): void {
    click();
    newGame(hero);
    save().flags.year = this.year;
    commit();
    startHero(app, hero, true);
  }

  render(g: CanvasRenderingContext2D, app: App): void {
    this.ptrMoved = pointer.x !== this.lastPtr.x || pointer.y !== this.lastPtr.y;
    this.lastPtr = { x: pointer.x, y: pointer.y };
    if (this.mode === 'credits') { this.credits(g); return; }
    this.backdrop(g);
    this.badge(g);
    this.heroes(g);
    switch (this.mode) {
      case 'main': this.main(g, app); break;
      case 'year': this.main(g, app, true); this.yearModal(g); break;
      case 'hero': this.heroPicker(g, app); break;
      case 'options': this.main(g, app, true); this.optionsModal(g); break;
      case 'confirm': this.main(g, app, true); this.confirmModal(g); break;
    }
  }

  /** The two worlds side by side: Terragrifus (Academy courtyard, left) and the Sea of Numbers (right) under the two moons. */
  private backdrop(g: CanvasRenderingContext2D): void {
    const t = this.t;
    drawSky(g, t, false);
    drawMoons(g, 1030, 170, 0.62);
    const hz = 600;
    // sea (right) with floating numbers and a ship on the horizon
    const sea = g.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#2a5a9a'); sea.addColorStop(1, '#0c1d3e');
    g.fillStyle = sea; g.fillRect(560, hz, W - 560, H - hz);
    g.save(); g.globalAlpha = 0.85; drawShip(g, 1030 + Math.sin(t * 0.25) * 60, hz + 4, 0.42); g.restore();
    g.strokeStyle = 'rgba(190,225,255,0.35)'; g.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      const y = hz + 18 + k * 40;
      g.beginPath();
      for (let x = 560; x <= W; x += 12) { const yy = y + Math.sin(x * 0.03 + t * 1.6 + k) * 4; if (x === 560) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const x = 620 + ((i * 131 + t * 14) % 560), y = hz + 40 + ((i * 67) % 230) + Math.sin(t * 2 + i) * 6;
      g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 1.5 + i);
      pixText(g, String((i * 7) % 10), x, y, { size: 22, color: '#cfe8ff' });
    }
    g.globalAlpha = 1;
    // dock planks under Pi
    g.fillStyle = '#6a4424'; g.fillRect(840, 790, W - 840, 110);
    g.fillStyle = '#4a2c14'; for (let x = 840; x < W; x += 56) g.fillRect(x, 790, 4, 110);
    g.fillStyle = '#8a5a30'; g.fillRect(840, 786, W - 840, 8);
    // Academy courtyard (left): stone ground and the fountain
    const land = g.createLinearGradient(0, hz, 0, H); land.addColorStop(0, '#4a5070'); land.addColorStop(1, '#22263c');
    g.fillStyle = land;
    g.beginPath(); g.moveTo(0, hz); g.lineTo(600, hz); g.quadraticCurveTo(640, 760, 560, H); g.lineTo(0, H); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2;
    for (let k = 1; k < 6; k++) { const y = hz + (H - hz) * (k / 6) ** 1.3; g.beginPath(); g.moveTo(0, y); g.lineTo(600 - k * 8, y); g.stroke(); }
    const gl = g.createRadialGradient(312, 600, 10, 312, 600, 170);
    gl.addColorStop(0, 'rgba(120,200,255,0.3)'); gl.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = gl; g.fillRect(140, 420, 400, 360);
    const ft = img('caza/objects/obj_011_fountain/images/obj_011_fountain_default.png');
    if (ft) g.drawImage(ft, 250, 556, 228 * 0.56, 235 * 0.56);
  }

  /** The CazaPira logo on top. */
  private badge(g: CanvasRenderingContext2D): void {
    const logo = img('cazapira/logo.png');
    if (!logo) return;
    const size = 380, bob = Math.sin(this.t * 1.6) * 4;
    g.drawImage(logo, W / 2 - size / 2, 8 + bob, size, size);
  }

  /** Aki (Cazaproblemas, left) and Pi with Flo (Piracálculos, right), breathing on their side of the world. */
  private heroes(g: CanvasRenderingContext2D): void {
    const t = this.t;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(160, 842, 90, 16, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(1020, 842, 100, 16, 0, 0, Math.PI * 2); g.fill();
    // only the hero you play wears the owned outfit; the other keeps the original look (Pi's skin comes from the keyed hook)
    const aki = img(`caza/objects/pc/images/pc_${outfitFor('aki')}_default_e001.png`) ?? img('caza/objects/pc/images/pc_default_default_e001.png');
    if (aki) { const b = Math.sin(t * 2) * 3; g.drawImage(aki, 160 - 105, 842 - 300 + b, 210, 300 - b); }
    // every Pi / Flo frame faces left: they look toward the menu without mirroring
    const pi = img('pira/images/characters/Pi/Pi_00.png', true);
    if (pi) { const b = Math.sin(t * 2 + 1) * 3; g.drawImage(pi, 1020 - 160, 842 - 300 + b, 320, 320 - b); }
    const flo = img(`pira/images/characters/Flo/Loro_0${1 + (Math.floor(t * 7) % 2)}.png`, true);
    if (flo) { g.save(); g.translate(1100 + Math.sin(t * 0.9) * 30, 470 + Math.sin(t * 3) * 10); g.scale(0.85, 0.85); g.drawImage(flo, -64, -100); g.restore(); }
  }

  private main(g: CanvasRenderingContext2D, app: App, dim = false): void {
    const px = W / 2 - 200, py = 400, pw = 400, ph = 410;
    parchment(g, px, py, pw, ph);
    const k = 1.55;
    this.items.forEach((it, i) => {
      const cy = py + 70 + i * 88;
      const w = it.w * k, h = it.h * k, x = W / 2 - w / 2, y = cy - h / 2;
      const over = !dim && !it.disabled && pointer.inside && pointer.x >= px + 20 && pointer.x < px + pw - 20 && pointer.y >= cy - 40 && pointer.y < cy + 40;
      if (over && this.ptrMoved && this.sel !== i) { this.sel = i; playSound('caza/sounds/general/btn_over.ogg', 0.35); }
      const on = !dim && this.sel === i && !it.disabled;
      if (on) {
        g.save();
        roundRect(g, px + 26, cy - 38, pw - 52, 76, 18);
        const hl = g.createLinearGradient(px, 0, px + pw, 0);
        hl.addColorStop(0, 'rgba(255,194,14,0)'); hl.addColorStop(0.5, 'rgba(255,194,14,0.5)'); hl.addColorStop(1, 'rgba(255,194,14,0)');
        g.fillStyle = hl; g.fill(); g.restore();
        // Pi's hat as the cursor
        const hat = img('pira/images/characters/Pi/Pi_00.png', true);
        const bob = Math.sin(this.t * 6) * 4;
        if (hat) g.drawImage(hat, 40, 20, 176, 90, px + 6 + bob, cy - 26, 88, 45);
      }
      const state = it.disabled || dim ? 'ns' : on ? (pointer.down && over ? 'press' : 'over') : 'normal';
      const im = img(`${MENU}main/${it.sprite}_${state}.png`) ?? img(`${MENU}main/${it.sprite}_normal.png`);
      if (im) {
        g.save();
        if (on) { g.translate(W / 2, cy); g.scale(1.06, 1.06); g.translate(-W / 2, -cy); }
        g.drawImage(im, x, y, w, h);
        g.restore();
      }
      if (over && pointer.clicked) this.menu(app, it.id);
    });
    if (!dim) {
      text(g, '↑ ↓  elegir     Espacio / clic  aceptar', W / 2, py + ph - 26, { size: 18, align: 'center', color: '#7a4a22' });
      text(g, 'Piracálculos × Los Cazaproblemas  ·  Un mod de Vicemi Dev', W / 2, H - 16, { size: 18, align: 'center', color: 'rgba(255,243,192,0.85)', outline: '#000', outlineW: 4 });
    }
  }

  private menu(app: App, id: string): void {
    click();
    this.msel = 0;
    if (id === 'new') this.mode = hasSave() ? 'confirm' : 'year';
    else if (id === 'continue') { const s = resume(); startHero(app, s.hero ?? 'aki', false); }
    else if (id === 'options') this.mode = 'options';
    else if (id === 'credits') { this.mode = 'credits'; this.page = 0; }
  }

  private modalPick(i: number): void {
    click();
    if (this.mode === 'year') { this.year = i === 0 ? 5 : 6; this.mode = 'hero'; this.sel = 0; this.heroSince = this.t; }
    else if (this.mode === 'confirm') { this.mode = i === 0 ? 'year' : 'main'; this.msel = 0; }
    else if (this.mode === 'options') { if (i === 0) setMusicEnabled(!isMusicOn()); else setSoundEnabled(!isSoundOn()); }
  }

  /** Centered parchment window with a title, a note and two big round buttons of the original menus. */
  private modal(g: CanvasRenderingContext2D, title: string, note: string, buttons: { sprite?: (on: boolean) => string; icon?: string; color?: string; label: string; sub?: string }[]): void {
    g.fillStyle = 'rgba(20,8,4,0.55)'; g.fillRect(0, 0, W, H);
    const w = 660, h = 350, x = W / 2 - w / 2, y = 400;
    parchment(g, x, y, w, h);
    ribbon(g, W / 2, y - 26, 440, title, 24);
    text(g, note, W / 2, y + 74, { size: 22, align: 'center', color: '#5a3416' });
    buttons.forEach((b, i) => {
      const cx = W / 2 + (i === 0 ? -150 : 150), cy = y + 170;
      const over = pointer.inside && Math.hypot(pointer.x - cx, pointer.y - cy) < 56;
      if (over && this.ptrMoved) this.msel = i;
      const on = this.msel === i;
      if (on) { g.fillStyle = 'rgba(255,194,14,0.45)'; g.beginPath(); g.arc(cx, cy, 62 + Math.sin(this.t * 6) * 3, 0, Math.PI * 2); g.fill(); }
      const im = b.sprite ? img(b.sprite(on)) : null;
      if (im) g.drawImage(im, cx - 46, cy - 46, 92, 92);
      else if (b.icon) {
        // round medal in the style of the original menu buttons
        g.save();
        g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2); g.fillStyle = b.color ?? '#c8202c'; g.fill();
        g.lineWidth = 6; g.strokeStyle = on ? '#fff3c0' : '#5a3416'; g.stroke();
        g.restore();
        if (!pixText(g, b.icon, cx, cy + 14, { size: 38, align: 'center', color: '#fff3c0', outline: '#2a1208' })) text(g, b.icon, cx, cy + 14, { size: 40, align: 'center', weight: 800, color: '#fff3c0' });
      }
      text(g, b.label, cx, cy + 86, { size: 24, align: 'center', weight: 700, color: on ? '#c8202c' : '#5a3416' });
      if (b.sub) text(g, b.sub, cx, cy + 112, { size: 17, align: 'center', color: '#7a4a22' });
      if (over && pointer.clicked) this.modalPick(i);
    });
  }

  /** Difficulty: Normal = 5th-year problems with free hints and more time; Difícil = 6th-year problems. */
  private yearModal(g: CanvasRenderingContext2D): void {
    this.modal(g, '¿QUÉ DIFICULTAD PREFERÍS?', 'Los problemas de 5.º o 6.º de primaria que traen los juegos.', [
      { icon: 'N', color: '#1f7a46', label: 'Normal', sub: '5.º de primaria · más tiempo y pistas' },
      { icon: 'D', color: '#c8202c', label: 'Difícil', sub: '6.º de primaria · cálculos más largos' },
    ]);
  }

  private optionsModal(g: CanvasRenderingContext2D): void {
    this.modal(g, 'OPCIONES DE AUDIO', 'Clic para activar o desactivar.   Esc: volver', [
      { sprite: (on) => `${MENU}options/btn_${isMusicOn() ? 'on' : 'off'}_${on ? 'over' : 'pressed'}.png`, label: `Música: ${isMusicOn() ? 'sí' : 'no'}` },
      { sprite: (on) => `${MENU}options/btn_${isSoundOn() ? 'on' : 'off'}_${on ? 'over' : 'pressed'}.png`, label: `Efectos: ${isSoundOn() ? 'sí' : 'no'}` },
    ]);
  }

  private confirmModal(g: CanvasRenderingContext2D): void {
    this.modal(g, '¿EMPEZAR DE NUEVO?', 'Se borrará la partida guardada.', [
      { sprite: () => `${MENU}newgame/btn_yes_over.png`, label: 'Sí' },
      { sprite: () => `${MENU}newgame/btn_no_over.png`, label: 'No' },
    ]);
  }

  private heroPicker(g: CanvasRenderingContext2D, app: App): void {
    g.fillStyle = 'rgba(25,10,5,0.62)'; g.fillRect(0, 0, W, H);
    ribbon(g, W / 2, 40, 640, '¿CON QUIÉN VIVIRÁS LA AVENTURA?', 26);
    const cards = [
      { hero: 'aki' as const, x: 130, name: 'AKI', col: '#c8202c', desc: 'Aprendiz de la Academia e hijo de Gladius. Estudia en las Torres mientras Pi busca pistas por su lado.' },
      { hero: 'pi' as const, x: 630, name: 'PI', col: '#1f7a46', desc: 'Capitán pirata criado por Gladius, con su loro Flo. Se inscribe en la Academia mientras Aki investiga por su lado.' },
    ];
    cards.forEach((c, i) => {
      const r = { x: c.x, y: 140, w: 440, h: 620 };
      const over = pointer.inside && pointer.x >= r.x && pointer.x < r.x + r.w && pointer.y >= r.y && pointer.y < r.y + r.h;
      if (over && this.ptrMoved) this.sel = i;
      const on = this.sel === i;
      const lift = on ? -10 + Math.sin(this.t * 3) * 2 : 0;
      g.save();
      g.translate(0, lift);
      if (on) { g.shadowColor = '#ffc20e'; g.shadowBlur = 30; }
      roundRect(g, r.x, r.y, r.w, r.h, 22); g.fillStyle = '#1a120c'; g.fill();
      g.shadowBlur = 0;
      g.save();
      roundRect(g, r.x, r.y, r.w, r.h, 22); g.clip();
      if (c.hero === 'aki') {
        const gr = g.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, '#f7e7bb'); gr.addColorStop(1, '#e2c27c');
        g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
        const map = img('caza/screens/inventory/map/img_map_academy.png');
        if (map) { g.globalAlpha = 0.18; g.drawImage(map, r.x - 60, r.y + 40, r.w + 120, 380); g.globalAlpha = 1; }
      } else {
        const sea = img('pira/images/level3/Fondos/Fondo_01.jpg');
        if (sea) { const k = r.h / 900; g.drawImage(sea, r.x - 300, r.y, 1200 * k * 1.0, r.h); }
        g.fillStyle = 'rgba(10,30,40,0.25)'; g.fillRect(r.x, r.y, r.w, r.h);
      }
      // character
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(r.x + r.w / 2, r.y + 440, 110, 20, 0, 0, Math.PI * 2); g.fill();
      if (c.hero === 'aki') {
        const im = img(`caza/objects/pc/images/pc_${outfitFor('aki')}_default_s001.png`) ?? img('caza/objects/pc/images/pc_default_default_s001.png');
        if (im) g.drawImage(im, r.x + r.w / 2 - 112, r.y + 440 - 320, 224, 320);
      } else {
        const im = img('pira/images/characters/Pi/PiConLoro00.png', true);
        if (im) g.drawImage(im, r.x + r.w / 2 - 150, r.y + 446 - 358, 300, 358);
        const flo = img(`pira/images/characters/Flo/Loro_0${1 + (Math.floor(this.t * 7) % 2)}.png`, true);
        if (flo) { g.save(); g.translate(r.x + 90, r.y + 170 + Math.sin(this.t * 5) * 6); g.scale(-0.8, 0.8); g.drawImage(flo, -64, -100); g.restore(); }
      }
      // name plate and description
      g.fillStyle = c.col; g.fillRect(r.x, r.y + 462, r.w, 64);
      g.fillStyle = '#ffc20e'; g.fillRect(r.x, r.y + 462, r.w, 4); g.fillRect(r.x, r.y + 522, r.w, 4);
      if (!pixText(g, c.name, r.x + r.w / 2, r.y + 512, { size: 40, align: 'center', color: '#fff3c0', outline: '#3a0a08' })) text(g, c.name, r.x + r.w / 2, r.y + 510, { size: 44, align: 'center', weight: 800, color: '#fff3c0' });
      g.fillStyle = 'rgba(255,248,225,0.94)'; g.fillRect(r.x, r.y + 526, r.w, r.h - 526);
      paragraph(g, c.desc, r.x + 22, r.y + 556, r.w - 44, 26, { size: 20, color: '#3a2412', weight: 500 });
      g.restore();
      roundRect(g, r.x, r.y, r.w, r.h, 22); g.lineWidth = on ? 6 : 3; g.strokeStyle = on ? '#ffc20e' : '#5a3a1a'; g.stroke();
      if (!on) { roundRect(g, r.x, r.y, r.w, r.h, 22); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fill(); }
      g.restore();
      if (over && pointer.clicked) this.pickHero(app, c.hero);
    });
    text(g, 'El héroe que no elijas seguirá su propio camino y aparecerá a lo largo de la historia.', W / 2, 820, { size: 22, align: 'center', color: '#fff3c0' });
    text(g, '← →  elegir     Espacio / clic  confirmar     Esc  volver', W / 2, 862, { size: 20, align: 'center', color: 'rgba(255,243,192,0.75)' });
  }

  /** Credits: the mod author first (Vicemi Dev), then the Cazaproblemas pages, then the Piracálculos card and the legal note. */
  private credits(g: CanvasRenderingContext2D): void {
    const pages = [null, 'caza/screens/menus/credits/img_credits_1.jpg', 'caza/screens/menus/credits/img_credits_2.jpg', 'caza/screens/menus/credits/img_credits_3.jpg', 'pira/lang/images/credits/creditos.jpg', null];
    const last = pages.length - 1;
    const src = pages[this.page];
    if (this.page === 0) {
      const bg = img('caza/screens/menus/credits/img_credits_3.jpg');
      if (bg) g.drawImage(bg, 0, 0, W, H);
      g.fillStyle = '#e9d9ae'; roundRect(g, 70, 80, 1060, 740, 28); g.fill();
      text(g, 'CazaPira', W / 2, 200, { size: 110, align: 'center', weight: 800, color: '#c8202c', outline: '#fff3c0', outlineW: 12 });
      text(g, 'Piracálculos × Los Cazaproblemas', W / 2, 262, { size: 32, align: 'center', weight: 700, color: '#7a2a12' });
      text(g, 'UN MOD CREADO POR', W / 2, 380, { size: 30, align: 'center', weight: 700, color: '#6a4c2a' });
      text(g, 'Vicemi Dev', W / 2, 480, { size: 110, align: 'center', weight: 800, color: '#c8202c', outline: '#ffd873', outlineW: 14 });
      paragraph(g, 'Fusión de los dos mundos, historia nueva y prólogo común, mecánicas mixtas, duelos de cálculo, Ecos, compañeros, finales, adaptación web y móvil.', 140, 560, 920, 44, { size: 30, color: '#3a2412', weight: 500 });
      text(g, 'Una idea que nació de una amiga · Programado con ayuda de Claude Code (IA)', W / 2, 712, { size: 22, align: 'center', color: '#6a4c2a' });
      text(g, 'Jugalo en cazapiru.vicemi.dev', W / 2, 752, { size: 26, align: 'center', weight: 700, color: '#c8202c' });
    } else if (this.page === last) {
      const bg = img('caza/screens/menus/credits/img_credits_3.jpg');
      if (bg) g.drawImage(bg, 0, 0, W, H);
      g.fillStyle = '#e9d9ae'; roundRect(g, 70, 80, 1060, 740, 28); g.fill();
      text(g, 'CRÉDITOS DE LOS JUEGOS ORIGINALES', W / 2, 160, { size: 44, align: 'center', weight: 800, color: '#c8202c' });
      paragraph(g, 'Los Cazaproblemas: mundo, mapas, personajes, guion, problemas, arte y música originales de sus autores (créditos en las páginas anteriores).', 120, 230, 960, 42, { size: 28, color: '#3a2412' });
      paragraph(g, 'Piracálculos: idea original de Laura Alvarez, Patricia Hernández y Fabián Rodríguez. Producción ejecutiva: Plan Ceibal. Producción y diseño: Campeón. Programación: Batoví (Gonzalo Ordeix). Audio: F.A.M.', 120, 400, 960, 42, { size: 28, color: '#3a2412' });
      paragraph(g, 'CazaPira es un proyecto de fans sin fines de lucro: los juegos originales, sus personajes y recursos pertenecen a sus autores y a sus respectivos dueños. Se necesita tener los juegos originales para obtener los recursos.', 120, 590, 960, 40, { size: 24, color: '#6a4c2a' });
    } else if (src) {
      const im = img(src);
      if (im) g.drawImage(im, 0, 0, W, H);
    }
    text(g, `Clic / Espacio: seguir   ·   Esc: volver   (${this.page + 1}/${pages.length})`, W / 2, H - 22, { size: 22, align: 'center', color: '#7a2a12', outline: '#fff3d0', outlineW: 6 });
    if (pointer.clicked || isPressed('act')) { this.page++; if (this.page > last) { this.page = 0; this.mode = 'main'; } }
  }
}
