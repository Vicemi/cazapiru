// Story scenes: the shared comic prologue, the meeting at the fountain, the finale under the fountain and the endings.
import { App, W, H, type Scene } from '../core/app';
import { img, preload } from '../core/assets';
import { playMusic, playSound, stopMusic } from '../core/audio';
import { isPressed, pointer } from '../core/input';
import { text, panel, button } from '../ui/text';
import { DialogUI } from '../ui/dialog';
import { heroName } from '../story/hero';
import { FINALE_INTRO, FINALE_OUTRO, FINALE_SABIO_INTRO, FINALE_SABIO_LOSE, FINALE_SABIO_WIN, closedEcos } from '../story/fusion';
import { DuelScene } from '../caza/duel';
import { MEETING } from '../story/prologue';
import { skinned } from '../story/skins';
import { PARTING } from '../story/partner';
import { COMIC_ASSETS, COMIC_PAGES, courtyard, drawBalloon, drawCaption, panelBorder, panelShadow } from '../story/comic';
import { clamp01, comicPaper, easeOutBack, ribbon, sparkle, visPortal } from '../ui/fx';
import { commit, isEasy, save } from '../save';
import { drawSky } from './title';
import { toTitle } from './flow';

/** The comic-book prologue (same for Aki and Pi): pages of panels that pop in one click at a time, then the meeting at the fountain. */
export class IntroScene implements Scene {
  private page = 0;
  private shown = 1;
  private t = 0;
  private appear: number[] = [0];
  /** page turn: the old page fades while the new one comes in */
  private turnT = 1;

  constructor(private hero: 'aki' | 'pi', private isNew = true) {}

  async enter(app: App): Promise<void> {
    app.state.scene = 'story';
    app.state.touch = 'none';
    await Promise.all([preload(COMIC_ASSETS.plain, false), preload(COMIC_ASSETS.keyed, true)]);
    playMusic('caza/music/maintheme.ogg', 0.6);
    this.appear = [this.t];
  }

  update(dt: number, app: App): void {
    this.t += dt;
    this.turnT = Math.min(1, this.turnT + dt * 2.5);
    const skip = pointer.pressed && pointer.x > W - 200 && pointer.y < 70;
    if (isPressed('back') || skip) { app.goto(new MeetingScene(this.hero)); return; }
    const panels = COMIC_PAGES[this.page].panels;
    if (this.t - (this.appear[this.shown - 1] ?? 0) > 0.35 && (isPressed('act') || pointer.pressed)) {
      playSound('caza/sounds/general/btn_press.ogg', 0.4);
      if (this.shown < panels.length) { this.appear[this.shown] = this.t; this.shown++; }
      else if (this.page < COMIC_PAGES.length - 1) { this.page++; this.shown = 1; this.appear = [this.t]; this.turnT = 0; }
      else app.goto(new MeetingScene(this.hero));
    }
  }

  render(g: CanvasRenderingContext2D): void {
    comicPaper(g);
    const page = COMIC_PAGES[this.page];
    g.save();
    g.globalAlpha = clamp01(this.turnT * 1.4);
    g.translate((1 - easeOutBack(this.turnT)) * 60, 0);
    ribbon(g, W / 2, 16, 520, page.title, 26);
    page.panels.forEach((p, i) => {
      if (i >= this.shown) return;
      const k = clamp01((this.t - (this.appear[i] ?? 0)) / 0.35);
      const s = 0.92 + 0.08 * easeOutBack(k);
      const cx = p.r.x + p.r.w / 2, cy = p.r.y + p.r.h / 2;
      g.save();
      g.globalAlpha *= k;
      g.translate(cx, cy + (1 - k) * 18); g.scale(s, s); g.translate(-cx, -cy);
      panelShadow(g, p.r);
      g.save();
      g.beginPath(); g.rect(p.r.x, p.r.y, p.r.w, p.r.h); g.clip();
      p.paint(g, p.r, this.t);
      g.restore();
      panelBorder(g, p.r);
      if (p.caption) drawCaption(g, p.r, p.caption, p.cap);
      for (const b of p.balloons ?? []) drawBalloon(g, p.r, b);
      g.restore();
    });
    g.restore();
    const last = this.shown >= page.panels.length;
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 4);
    text(g, last ? (this.page < COMIC_PAGES.length - 1 ? 'Siguiente página ▶' : 'Continuar ▶') : 'Clic / Espacio ▶', W - 44, H - 18, { size: 24, align: 'right', weight: 700, color: `rgba(122,42,18,${pulse})` });
    text(g, `${this.page + 1} / ${COMIC_PAGES.length}`, 44, H - 18, { size: 22, color: '#7a5a3a' });
    // skip button (top right): works with mouse and touch
    g.save(); g.fillStyle = 'rgba(42,26,16,0.75)'; g.beginPath(); g.roundRect(W - 186, 14, 170, 46, 23); g.fill(); g.restore();
    text(g, 'Saltar ▶▶', W - 101, 46, { size: 24, align: 'center', weight: 700, color: '#fff3c0' });
  }
}

/** The night the sea folded: Pi and Flo fall at the Academy fountain and meet Aki. Shared by both heroes; the speaker steps forward. */
export class MeetingScene implements Scene {
  private dialog = new DialogUI();
  private t = 0;
  /** smoothed emphasis per character (0 = in the back, 1 = speaking) */
  private focus: Record<string, number> = { aki: 0, pi: 0, quimerius: 0 };

  constructor(private hero: 'aki' | 'pi') {}

  async enter(app: App): Promise<void> {
    app.state.scene = 'story';
    app.state.touch = 'keys';
    await preload(['caza/objects/pc/images/pc_default_default_e001.png', 'caza/objects/obj_011_fountain/images/obj_011_fountain_default.png'], false);
    await preload(['pira/images/characters/Pi/Pi_00.png', 'pira/images/characters/Flo/Loro_01.png', 'pira/images/characters/Flo/Loro_02.png', 'caza/objects/npc005_quimerius/images/npc005_quimerius_default_default_s001.png'], true);
    playMusic('caza/music/maintheme.ogg', 0.55);
    void (async () => {
      for (const l of MEETING) await this.dialog.say(l);
      for (const l of PARTING(this.hero)) await this.dialog.say(l);
      const s = save();
      s.flags.met = 1;
      commit();
      const { CazaScene } = await import('./caza');
      // the adventure starts where the prologue ends: at the Academy fountain (Luceria waits just below)
      app.goto(new CazaScene('academy', 'FOUNTAIN_SPAWN_POINT'));
    })();
  }

  update(dt: number): void {
    this.t += dt;
    this.dialog.update(dt);
    const sp = this.dialog.speaker;
    const who = sp === 'Aki' ? 'aki' : sp === 'Pi' || sp === 'Flo' ? 'pi' : sp.includes('Quimerius') ? 'quimerius' : '';
    for (const k of Object.keys(this.focus)) this.focus[k] += ((k === who ? 1 : 0) - this.focus[k]) * Math.min(1, dt * 8);
  }

  render(g: CanvasRenderingContext2D): void {
    const r = { x: 0, y: 0, w: W, h: 600 };
    courtyard(g, r, this.t, 0.62);
    g.fillStyle = '#1a1d30'; g.fillRect(0, 600, W, H - 600);
    visPortal(g, 600, 150, 70, this.t);
    const ground = 520;
    const shadowAt = (x: number, w: number): void => { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, ground, w, w / 5, 0, 0, Math.PI * 2); g.fill(); };
    const lit = (k: number): void => { g.filter = k > 0.5 ? 'none' : `brightness(${0.62 + 0.38 * k * 2})`; };
    // Aki (left, facing right) — original sprite, scaled up
    const fa = this.focus.aki;
    const aki = img('caza/objects/pc/images/pc_default_default_e001.png');
    shadowAt(330, 70);
    if (aki) {
      const ih = 100, iw = 70, hgt = 300 + 20 * fa, k = hgt / ih;
      g.save(); lit(fa); g.translate(330, ground - hgt + Math.sin(this.t * 2) * 2); g.drawImage(aki, -iw * k / 2, 0, iw * k, hgt); g.restore();
    }
    // Pi (right, facing left) with Flo
    const fp = this.focus.pi;
    const pi = img('pira/images/characters/Pi/Pi_00.png', true);
    shadowAt(870, 80);
    if (pi) {
      const s = 1.25 + 0.08 * fp;
      g.save(); lit(fp); g.translate(870, ground + 6 - 256 * s + Math.sin(this.t * 2 + 1) * 2); g.scale(s, s); g.drawImage(pi, -128, 0); g.restore();
    }
    const flo = img(`pira/images/characters/Flo/Loro_0${1 + (Math.floor(this.t * 7) % 2)}.png`, true);
    if (flo) { g.save(); g.translate(990, 300 + Math.sin(this.t * 5) * 8); g.scale(0.8, 0.8); g.drawImage(flo, -64, -100); g.restore(); }
    g.filter = 'none';
    // Quimerius speaks through the console: a blue hologram above the fountain
    const fq = this.focus.quimerius;
    if (fq > 0.02) {
      const q = img('caza/objects/npc005_quimerius/images/npc005_quimerius_default_default_s001.png', true);
      if (q) {
        g.save();
        g.globalAlpha = fq * (0.75 + 0.1 * Math.sin(this.t * 9));
        g.filter = 'sepia(1) hue-rotate(170deg) saturate(3) brightness(1.2)';
        g.drawImage(q, 600 - 98, 250, 196, 216);
        g.filter = 'none';
        g.fillStyle = 'rgba(160,220,255,0.12)';
        for (let y = 250; y < 466; y += 6) g.fillRect(600 - 98, y, 196, 2);
        g.restore();
        for (let i = 0; i < 5; i++) sparkle(g, 520 + i * 40, 260 + ((this.t * 60 + i * 37) % 200), 2, fq * 0.7);
      }
    }
    this.dialog.render(g);
  }
}

// ------------------------------------------------------------------ finale under the Fountain
export class FinaleScene implements Scene {
  private dialog = new DialogUI();
  private oli = false;
  private phase: 'intro' | 'duel' | 'fight' | 'outro' | 'done' = 'intro';
  private t = 0;
  private app!: App;

  async enter(app: App): Promise<void> {
    this.app = app;
    app.state.scene = 'story';
    app.state.touch = 'keys';
    this.dialog.subst = (s) => heroName(s);
    await preload(['pira/images/level6/Fondos/Fondo_01.jpg'], false);
    await preload(['caza/objects/npc005_quimerius/images/npc005_quimerius_default_default_s001.png', 'caza/objects/pc/images/pc_default_default_e001.png'], false);
    await preload(['caza/objects/npc005_quimerius/images/npc005_quimerius_default_default_s001.png'], true);
    await preload(['pira/images/characters/Olivera/Olivera_A01.png', 'pira/images/characters/Pi/PiConLoro00.png', 'pira/images/characters/Pi/Pi_00.png'], true);
    stopMusic();
    playMusic('pira/audio/music/Nivel_6.ogg', 0.8);
    void this.run();
  }

  private async run(): Promise<void> {
    for (const l of FINALE_SABIO_INTRO()) await this.dialog.say(l);
    // boss 1: the Duel of the Sage (Cazaproblemas side): five problems from both games, four right
    for (;;) {
      this.phase = 'duel';
      const won = await new Promise<boolean>((res) => { void this.app.push(new DuelScene('sabio', (r) => res(r.won), 5, isEasy() ? 3 : 4)); });
      this.phase = 'intro';
      if (won) break;
      for (const l of FINALE_SABIO_LOSE()) await this.dialog.say(l);
    }
    for (const l of FINALE_SABIO_WIN()) await this.dialog.say(l);
    // boss 2: Olivera (Piracálculos side)
    this.oli = true;
    for (const l of FINALE_INTRO()) await this.dialog.say(l);
    await this.fight();
  }

  private async fight(): Promise<void> {
    this.phase = 'fight';
    const { makeLevel } = await import('../pira');
    const lvl = await makeLevel(6, (r) => {
      if (r.won) { save().score += r.score; save().pira.stars[5] = Math.max(save().pira.stars[5], r.stars); void this.outro(); }
      else void this.dialog.say('[Olivera] ¡Ja! Todavía no saben contar. ¡Vuelvan cuando estén listos!').then(() => this.fight());
    });
    await this.app.push(lvl);
  }

  private async outro(): Promise<void> {
    this.phase = 'outro';
    const s = save();
    for (const l of FINALE_OUTRO(closedEcos(s))) await this.dialog.say(l);
    s.flags.finale = 1; s.pira.won = true; s.crystals += 30; commit();
    this.app.goto(new EndingScene());
  }

  update(dt: number): void { this.t += dt; this.dialog.update(dt); }

  render(g: CanvasRenderingContext2D): void {
    const bg = img('pira/images/level6/Fondos/Fondo_01.jpg');
    if (bg) g.drawImage(bg, 0, 0, W, H);
    g.fillStyle = 'rgba(0,20,60,0.35)'; g.fillRect(0, 0, W, H);
    const oli = img('pira/images/characters/Olivera/Olivera_A01.png', true);
    if (this.oli && oli) g.drawImage(oli, 560, 330 + Math.sin(this.t * 2) * 5, 657 * 0.8, 471 * 0.8);
    const qm = img('caza/objects/npc005_quimerius/images/npc005_quimerius_default_default_s001.png', true);
    if (!this.oli && qm) g.drawImage(qm, 760, 240 + Math.sin(this.t * 2) * 5, 130 * 2.6, 143 * 2.6);
    // both heroes face the boss together
    const aki = img('caza/objects/pc/images/pc_default_default_e001.png');
    if (aki) g.drawImage(aki, 90, 330 + Math.sin(this.t * 2 + 1) * 4, 105 * 1.6, 150 * 1.6);
    const pi = skinned('pira/images/characters/Pi/Pi_00.png');
    if (pi) { g.save(); g.translate(355, 285 - Math.sin(this.t * 2) * 4); g.scale(-1, 1); g.drawImage(pi, -125, 0, 250, 250); g.restore(); }
    this.dialog.render(g);
  }
}

// ------------------------------------------------------------------ endings
export class EndingScene implements Scene {
  private t = 0;
  enter(app: App): void {
    app.state.scene = 'story';
    app.state.touch = 'none';
    playMusic('caza/music/maintheme.ogg', 0.7);
  }
  update(dt: number): void { this.t += dt; }
  render(g: CanvasRenderingContext2D, app: App): void {
    drawSky(g, this.t, false);
    const s = save();
    // the two moons side by side again
    const glow = 0.15 + 0.05 * Math.sin(this.t * 2);
    g.fillStyle = `rgba(200,215,255,${glow})`; g.beginPath(); g.arc(400, 235, 150, 0, 7); g.fill();
    g.fillStyle = '#e8eefc'; g.beginPath(); g.arc(400, 235, 118, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,170,210,0.4)'; for (const [dx, dy, r] of [[-40, -24, 22], [30, 20, 28], [-6, 50, 14]]) { g.beginPath(); g.arc(400 + dx, 235 + dy, r, 0, 7); g.fill(); }
    g.fillStyle = `rgba(80,160,255,${glow + 0.1})`; g.beginPath(); g.arc(660, 262, 84, 0, 7); g.fill();
    g.fillStyle = '#4aa0ff'; g.beginPath(); g.arc(660, 262, 56, 0, 7); g.fill();
    g.fillStyle = '#8cd0ff'; g.beginPath(); g.arc(645, 246, 16, 0, 7); g.fill();
    text(g, '¡Las lunas volvieron a su lugar!', W / 2, 90, { size: 62, align: 'center', weight: 800, color: '#ffd873', outline: '#5a2a10', outlineW: 12 });
    panel(g, 190, 380, 820, 380, 'rgba(250,236,196,0.94)');
    const ecos = closedEcos(s);
    const rank = ecos >= 5 ? 'Final verdadero: el Vis cae para todos' : 'Final parcial: quedan Ecos abiertos en Terragrifus';
    text(g, rank, W / 2, 440, { size: 32, align: 'center', weight: 700, color: '#7a2a12' });
    const rows: [string, string][] = [['Ecos cerrados', `${ecos}/5`], ['Cristales', String(s.crystals)], ['Puntos', String(s.score)], ['Problemas resueltos', String(s.solved.length)]];
    rows.forEach(([k, v], i) => { text(g, k, 260, 505 + i * 48, { size: 32, color: '#3a2412' }); text(g, v, 940, 505 + i * 48, { size: 32, align: 'right', color: '#7a2a12', weight: 700 }); });
    if (button(g, { x: 230, y: 695, w: 360, h: 60, label: 'Seguir explorando' })) { void import('./caza').then(({ CazaScene }) => app.goto(new CazaScene('academy', 'FOUNTAIN_SPAWN_POINT'))); }
    if (button(g, { x: 610, y: 695, w: 360, h: 60, label: 'Volver al título' })) void toTitle(app);
    text(g, 'Gracias por jugar CazaPira', W / 2, H - 40, { size: 26, align: 'center', color: '#e8eefc' });
  }
}
