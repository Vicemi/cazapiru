// Shared frame of the six Piracálculos mini-games: instruction card, HUD (lives, score), pause, win / game-over screens.
import { App, W, H, type Scene } from '../core/app';
import { img, preload } from '../core/assets';
import { playMusic, playSound, preloadSounds, stopMusic } from '../core/audio';
import { isPressed, pointer } from '../core/input';
import { button, panel, text } from '../ui/text';
import { pixOrText } from '../ui/pixfont';

export interface PiraResult { won: boolean; score: number; stars: number; level: number }

const INTRO = ['one', 'two', 'three', 'four', 'five', 'boss'];
export const PI = 'pira/images/characters/Pi/';
export const FLO = 'pira/images/characters/Flo/';
export const A = (p: string): string => 'pira/' + p;
export const FX = (p: string): string => 'pira/audio/fx/' + p;

export const TITLES = ['¡Rescate pirata!', 'La cueva del pirata Olivera', '¡Todos a bordo!', 'Un bucanero sin buque', 'Tablero', '¡Sorpresa!… Olivera'];

export abstract class PiraLevel implements Scene {
  phase: 'loading' | 'intro' | 'play' | 'win' | 'lose' | 'pause' = 'loading';
  lives = 3;
  score = 0;
  t = 0;
  protected app!: App;
  /** where the lives/score panel sits (level 5 uses the top-left corner for the dice) */
  protected hudRight = false;
  private phaseT = 0;
  /** seconds of the current attempt (for time bonuses) */
  playT = 0;

  constructor(readonly level: number, private onDone: (r: PiraResult) => void, private maxLives = 3) { this.lives = maxLives; }

  /** images (color keyed) the level needs */
  protected abstract assets(): { keyed: string[]; plain: string[]; sounds: string[] };
  protected abstract start(): void;
  protected abstract tick(dt: number): void;
  protected abstract draw(g: CanvasRenderingContext2D): void;

  async enter(app: App): Promise<void> {
    this.app = app;
    app.state.scene = 'pira';
    app.state.touch = this.level >= 3 ? 'keys' : 'none';
    const a = this.assets();
    await Promise.all([
      preload(a.keyed, true), preload(a.plain, false),
      preload([A(`lang/images/intros/intro_${INTRO[this.level - 1]}.jpg`), A('lang/images/intros/perdiste.jpg'), A('lang/images/intros/fin.jpg'), PI + 'Pi_00.png'], false),
      preload([PI + 'Pi_00.png'], true),
      preloadSounds(a.sounds),
    ]);
    playMusic(A(`audio/music/Nivel_${this.level}.ogg`), 0.8);
    this.phase = 'intro';
    this.phaseT = 0;
  }

  leave(): void { stopMusic(); }

  protected finish(won: boolean): void {
    if (this.phase === 'win' || this.phase === 'lose') return;
    this.phase = won ? 'win' : 'lose';
    this.phaseT = 0;
    if (won) playSound(FX('NIVEL_1/Recoger_Llave.ogg'), 0.6);
  }
  protected loseLife(): boolean {
    this.lives--;
    if (this.lives <= 0) { this.finish(false); return true; }
    return false;
  }
  protected addScore(n: number): void { this.score += n; }
  protected stars(): number { return this.lives >= this.maxLives ? 3 : this.lives >= 2 ? 2 : 1; }

  update(dt: number, app: App): void {
    this.t += dt;
    this.phaseT += dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 0.7 && (isPressed('act') || pointer.pressed)) { this.phase = 'play'; this.playT = 0; this.start(); }
        break;
      case 'play':
        this.playT += dt;
        if (isPressed('back')) { this.phase = 'pause'; break; }
        this.tick(dt);
        break;
      case 'pause':
        if (isPressed('back')) this.phase = 'play';
        break;
      case 'win':
        if (this.phaseT > 0.8 && (isPressed('act') || pointer.pressed)) { app.pop(); this.onDone({ won: true, score: this.score, stars: this.stars(), level: this.level }); }
        break;
      case 'lose':
        break;
    }
  }

  render(g: CanvasRenderingContext2D, app: App): void {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    if (this.phase === 'loading') { text(g, 'Cargando…', W / 2, H / 2, { size: 48, align: 'center', color: '#ffd873' }); return; }
    if (this.phase === 'intro') {
      const im = img(A(`lang/images/intros/intro_${INTRO[this.level - 1]}.jpg`));
      if (im) g.drawImage(im, 0, 0, W, H);
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 4);
      text(g, 'Tocá o presioná Espacio para empezar', W / 2, H - 40, { size: 34, align: 'center', color: `rgba(200,20,10,${pulse})`, weight: 800, outline: '#fff3d0', outlineW: 8 });
      return;
    }
    this.draw(g);
    this.hud(g);
    if (this.phase === 'pause') {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H);
      panel(g, W / 2 - 280, 250, 560, 400);
      text(g, 'Pausa', W / 2, 330, { size: 60, align: 'center', weight: 800, color: '#7a2a12' });
      if (button(g, { x: W / 2 - 200, y: 380, w: 400, h: 70, label: 'Seguir' })) this.phase = 'play';
      if (button(g, { x: W / 2 - 200, y: 470, w: 400, h: 70, label: 'Abandonar nivel' })) { app.pop(); this.onDone({ won: false, score: this.score, stars: 0, level: this.level }); }
    } else if (this.phase === 'win') {
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H);
      panel(g, W / 2 - 330, 230, 660, 440);
      pixOrText(g, '¡Nivel completado!', W / 2, 335, { size: 52, align: 'center', color: '#7a2a12', outline: '#fff3d0' });
      text(g, `Puntos: ${this.score}`, W / 2, 410, { size: 44, align: 'center', color: '#3a2412' });
      text(g, '★'.repeat(this.stars()) + '☆'.repeat(3 - this.stars()), W / 2, 500, { size: 80, align: 'center', color: '#e8a010' });
      text(g, 'Tocá o presioná Espacio', W / 2, 620, { size: 30, align: 'center', color: '#6a4c2a' });
    } else if (this.phase === 'lose') {
      const im = img(A('lang/images/intros/perdiste.jpg'));
      if (im) g.drawImage(im, 0, 0, W, H);
      if (button(g, { x: W / 2 - 360, y: H - 130, w: 320, h: 80, label: 'Reintentar' })) { this.lives = this.maxLives; this.score = 0; this.phase = 'play'; this.playT = 0; this.start(); }
      if (button(g, { x: W / 2 + 40, y: H - 130, w: 320, h: 80, label: 'Salir' })) { app.pop(); this.onDone({ won: false, score: this.score, stars: 0, level: this.level }); }
    }
  }

  private hud(g: CanvasRenderingContext2D): void {
    const hat = img(PI + 'Pi_00.png', true);
    const ox = this.hudRight ? W - 390 : 14, oy = this.hudRight ? 760 : 12;
    panel(g, ox, oy, 360, 70, 'rgba(250,236,196,0.85)');
    for (let i = 0; i < this.maxLives; i++) {
      g.globalAlpha = i < this.lives ? 1 : 0.25;
      if (hat) g.drawImage(hat, ox + 10 + i * 52, oy + 2, 62, 62);
    }
    g.globalAlpha = 1;
    pixOrText(g, String(this.score).padStart(5, '0'), ox + 346, oy + 50, { size: 34, align: 'right', color: '#7a2a12' });
    if (!this.hudRight) {
      pixOrText(g, `Nivel ${this.level}`, W - 20, 38, { size: 24, align: 'right', color: '#fff', outline: '#000' });
      text(g, '[Esc] pausa', W - 20, 66, { size: 20, align: 'right', color: 'rgba(255,255,255,0.8)', outline: '#000', outlineW: 5 });
    }
  }
}

// ------------------------------------------------------------------ small helpers
export function drawCentered(g: CanvasRenderingContext2D, im: CanvasImageSource | null, x: number, y: number, scale = 1, flip = false, alpha = 1): void {
  if (!im) return;
  const w = (im as HTMLCanvasElement).width ?? (im as HTMLImageElement).naturalWidth;
  const h = (im as HTMLCanvasElement).height ?? (im as HTMLImageElement).naturalHeight;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.scale(flip ? -scale : scale, scale);
  g.drawImage(im, -w / 2, -h / 2);
  g.restore();
}
/** Bottom-center anchored sprite. */
export function drawFeet(g: CanvasRenderingContext2D, im: CanvasImageSource | null, x: number, y: number, scale = 1, flip = false): void {
  if (!im) return;
  const w = (im as HTMLCanvasElement).width ?? (im as HTMLImageElement).naturalWidth;
  const h = (im as HTMLCanvasElement).height ?? (im as HTMLImageElement).naturalHeight;
  g.save();
  g.translate(x, y);
  g.scale(flip ? -scale : scale, scale);
  g.drawImage(im, -w / 2, -h);
  g.restore();
}
