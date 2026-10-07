// Bootstrap: preload the fonts and the title assets, then hand over to the title scene.
import { App, W, H, type Scene } from './core/app';
import { img, preload } from './core/assets';
import { isPressed, pointer } from './core/input';
import { clamp01, easeOutBack } from './ui/fx';
import { preloadSounds } from './core/audio';
import { text } from './ui/text';
import { loadPixFont } from './ui/pixfont';
import './story/skins';   // registers the Pi skin hook
import { TitleScene } from './scenes/title';

class Boot implements Scene {
  private progress = 0;
  private started = false;
  enter(app: App): void {
    void (async () => {
      this.started = true;
      try { await Promise.all(['400', '500', '700', '800'].map((w) => document.fonts.load(`${w} 28px CPFutura`))); } catch { /* fallback font */ }
      await Promise.all([loadPixFont(), preload(['cazapira/logo.png'])]);
      this.progress = 0.3;
      await preload([
        'caza/objects/pc/images/pc_default_default_s001.png', 'caza/screens/menus/main/img_background.png',
        'caza/screens/menus/credits/img_credits_1.jpg', 'caza/screens/menus/credits/img_credits_2.jpg', 'caza/screens/menus/credits/img_credits_3.jpg', 'pira/lang/images/credits/creditos.jpg',
        ...['continue', 'newgame', 'options', 'credits', 'exit'].flatMap((n) => ['normal', 'over', 'press', 'ns'].map((st) => `caza/screens/menus/main/btn_${n}_${st}.png`)),
        ...[5, 6].flatMap((y) => ['normal', 'over', 'press'].map((st) => `caza/screens/menus/year/btn_${y}_${st}.png`)),
        'caza/screens/menus/options/btn_on_over.png', 'caza/screens/menus/options/btn_on_pressed.png', 'caza/screens/menus/options/btn_off_over.png', 'caza/screens/menus/options/btn_off_pressed.png',
        'caza/screens/menus/newgame/btn_yes_over.png', 'caza/screens/menus/newgame/btn_no_over.png',
      ]);
      await preload(['pira/images/characters/Pi/Pi_00.png', 'pira/images/characters/Pi/PiConLoro00.png', 'pira/images/characters/Flo/Loro_01.png'], true);
      this.progress = 0.8;
      await preloadSounds(['caza/sounds/general/btn_over.ogg', 'caza/sounds/general/btn_press.ogg']);
      this.progress = 1;
      app.goto(new LogoScene(), undefined, 0.3);
    })();
  }
  update(): void { /* async */ }
  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#0b1030';
    g.fillRect(0, 0, W, H);
    const logo = img('cazapira/logo.png');
    if (logo) g.drawImage(logo, W / 2 - 220, H / 2 - 300, 440, 440);
    else text(g, 'CazaPira', W / 2, H / 2 - 20, { size: 90, align: 'center', weight: 800, color: '#ffd873' });
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(W / 2 - 200, H / 2 + 190, 400, 12);
    g.fillStyle = '#ffc20e';
    g.fillRect(W / 2 - 200, H / 2 + 190, 400 * this.progress, 12);
    void this.started;
  }
}

/** Splash: the CazaPira logo pops in over a warm glow with rising embers, then the title menu. */
class LogoScene implements Scene {
  private t = 0;
  private left = false;
  update(dt: number, app: App): void {
    this.t += dt;
    if (!this.left && (this.t > 3.6 || (this.t > 0.6 && (isPressed('act') || pointer.pressed)))) { this.left = true; app.goto(new TitleScene(), undefined, 0.5); }
  }
  render(g: CanvasRenderingContext2D): void {
    const bg = g.createRadialGradient(W / 2, H / 2 - 30, 40, W / 2, H / 2, 760);
    bg.addColorStop(0, '#5a1e10'); bg.addColorStop(0.5, '#25100c'); bg.addColorStop(1, '#07060c');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const u = (this.t * (0.12 + (i % 5) * 0.03) + i * 0.173) % 1;
      const x = W / 2 + Math.sin(i * 12.9 + this.t * 0.8) * (220 + (i % 7) * 40), y = H - u * (H + 40);
      g.fillStyle = `rgba(255,${150 + (i % 4) * 25},60,${0.7 * (1 - u)})`;
      g.beginPath(); g.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); g.fill();
    }
    const k = easeOutBack(clamp01(this.t / 0.9));
    const glow = 0.35 + 0.1 * Math.sin(this.t * 6) + 0.05 * Math.sin(this.t * 13);
    const gl = g.createRadialGradient(W / 2, H / 2 - 20, 60, W / 2, H / 2 - 20, 380);
    gl.addColorStop(0, `rgba(255,170,60,${glow * clamp01(this.t * 2)})`); gl.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, H);
    const logo = img('cazapira/logo.png');
    if (logo) {
      const size = 680 * k;
      g.drawImage(logo, W / 2 - size / 2, H / 2 - 20 - size / 2 + Math.sin(this.t * 2) * 4, size, size);
    }
    if (this.t > 1.2) text(g, 'Tocá o presioná Espacio', W / 2, H - 36, { size: 24, align: 'center', color: `rgba(255,230,180,${0.5 + 0.4 * Math.sin(this.t * 4)})` });
  }
}

export function createGame(canvas: HTMLCanvasElement): App {
  const app = new App(canvas);
  app.start(new Boot());
  return app;
}
