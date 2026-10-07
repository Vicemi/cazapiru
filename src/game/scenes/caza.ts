// The Terragrifus exploration scene (Cazaproblemas world): map, player, NPC triggers driven by the original Lua scripts,
// dialogs, puzzle console, HUD.
import { App, W, H, type Scene } from '../core/app';
import { img, preload } from '../core/assets';
import { isDown, isPressed, pointer, keyDown } from '../core/input';
import { playMusic, playSound } from '../core/audio';
import { World, Ent, overlap, type Rect } from '../caza/world';
import { LuaHost, preloadScripts, type HostCtx } from '../caza/host';
import { loadPuzzles, PuzzleScene, type PuzzleResult } from '../caza/puzzle';
import { DialogUI } from '../ui/dialog';
import { text, panel } from '../ui/text';
import { commit, save } from '../save';
import type { LuaFunction } from '../caza/lua51';
import { heroName, heroSprite, makePartner, partnerOf } from '../story/hero';
import { visPortal } from '../ui/fx';
import { currentOutfit } from '../story/skins';
import { pixOrText } from '../ui/pixfont';
import { pendingEncounter, type Encounter } from '../story/partner';
import { PORTALS, RIFT_INTRO, closedEcos, markLevel, portalDone, portalOpen, type PortalDef } from '../story/fusion';
import { spawnEnemies, updateEnemies, defeat, aliveEnemies, type Enemy } from '../caza/enemies';
import { DuelScene } from '../caza/duel';
import { makeLevel } from '../pira';

/** touch screens show on-screen buttons instead of keyboard hints */
import { COARSE } from '../core/input';

export class CazaScene implements Scene {
  world = new World();
  host = new LuaHost();
  dialog = new DialogUI();
  ready = false;
  private app!: App;
  private lock = 0;
  private prompt = '';
  private transition = false;
  private time = 0;
  private touchDir = { x: 0, y: 0 };
  private portals: { def: PortalDef; ent: Ent }[] = [];
  private enemies: Enemy[] = [];
  private dueling = false;
  private storyBusy = false;

  private saveT = 0;

  constructor(readonly mapId = 'academy', private spawn?: string, private at?: { x: number; y: number }) {}

  async enter(app: App): Promise<void> {
    this.app = app;
    app.state.scene = 'caza';
    app.state.touch = 'full';
    await Promise.all([preloadScripts(), loadPuzzles()]);
    await this.world.load(this.mapId);
    const w = this.world;
    const def = { id: 'pc', images: [], outfits: ['default', 'brad', 'shadow', 'cold'], sounds: {}, collider: { ox: 0, oy: -7, w: 52, h: 12 } };
    const p = new Ent(def);
    p.outfit = currentOutfit();
    if (save().hero !== 'pi') await preload(w.walkFrames(def, p.outfit));
    // Pi (as hero or as partner) and Flo: all frames ready before the first step, so he never blinks out
    await preload([...Array.from({ length: 8 }, (_, i) => `pira/images/characters/Pi/Pi_Caminar_0${i}.png`), 'pira/images/characters/Pi/Pi_00.png',
      ...Array.from({ length: 5 }, (_, i) => `pira/images/characters/Flo/Loro_0${i + 1}.png`)], true);
    // spawn point; if the script names one the map does not have, use the map's own spawn points instead of a fixed spot
    const wp = (this.spawn ? w.waypoint(this.spawn) : null)
      ?? [...w.map.waypoints.entries()].find(([k]) => /SPAWN|START|DOOR/.test(k))?.[1] ?? null;
    p.x = this.at?.x ?? wp?.x ?? 920; p.y = this.at?.y ?? wp?.y ?? 1300; p.placed = true;
    // a resumed position inside a wall (old saves, moved objects) is pushed to the nearest walkable cell
    if (!w.standable(p.x, p.y)) { const c = w.nearestCell(p.x, p.y, 10); if (c) { const q = w.cellCenter(c[0], c[1]); p.x = q.x; p.y = q.y; } }
    heroSprite(w, p);
    w.player = p;
    w.ents.set('pc', p);
    this.dialog.subst = (s) => heroName(s);
    this.host.attach(this.ctx());
    this.host.boot();
    this.host.loadMapScript(this.mapId);
    for (const e of w.ents.values()) if (e.def.trigger) this.host.attachTrigger(e);
    w.snapCamera();
    this.ready = true;
    (save().flags as unknown as Record<string, string>).lastMap = this.mapId;
    this.host.runMapLoad();
    this.setupFusion();
    await this.setupPartner();
    this.worldMusic();
  }

  /** Each region borrows a track of the pirate sea: the two soundtracks share the world. */
  private worldMusic(): void {
    const m: Record<string, string> = { logiverum: 'pira/audio/music/Nivel_3.ogg', woods: 'pira/audio/music/Nivel_2.ogg', mountains: 'pira/audio/music/Nivel_5.ogg', dungeon_entrance: 'pira/audio/music/Nivel_6.ogg', dungeon_room: 'pira/audio/music/Nivel_6.ogg', dungeon_exit: 'pira/audio/music/Nivel_6.ogg' };
    playMusic(m[this.mapId] ?? 'caza/music/maintheme.ogg', 0.45);
  }

  // ------------------------------------------------------------------ the fused world: Ecos (portals) and pirate creatures
  private setupFusion(): void {
    const w = this.world, s = save();
    for (const def of PORTALS) {
      if (def.map !== this.mapId) continue;
      const wp = w.waypoint(def.wp);
      if (!wp) continue;
      const spot = this.freeSpot(wp.x + def.dx, wp.y + def.dy);
      const ent = new Ent({ id: def.id, images: [], outfits: [], sounds: {} });
      ent.solid = false; ent.placed = true; ent.x = spot.x; ent.y = spot.y;
      ent.custom = (g, e, sx, sy) => this.drawPortal(g, def, sx, sy);
      w.ents.set(def.id, ent);
      this.portals.push({ def, ent });
    }
    const outdoor = ['logiverum', 'woods', 'mountains'].includes(this.mapId);
    if (outdoor && s.tier >= 2050 && !s.flags.finale) {
      if (!s.flags.rift) {
        s.flags.rift = 1;
        commit();
        this.storyBusy = true;
        void (async () => { for (const l of RIFT_INTRO()) await this.dialog.say(l); this.storyBusy = false; })();
      }
      this.enemies = spawnEnemies(w, this.mapId === 'logiverum' ? 7 : 8);
    }
  }

  // ------------------------------------------------------------------ the other hero (goes "por su lado", shows up at story points)
  private partner: Ent | null = null;
  private encounter: Encounter | null = null;

  private async setupPartner(): Promise<void> {
    const s = save(), w = this.world, p = w.player;
    if (!s.hero || this.mapId.startsWith('dungeon')) return;
    if (partnerOf() === 'aki') await preload(w.walkFrames({ id: 'pc', images: [], outfits: ['default', 'brad', 'shadow', 'cold'], sounds: {} }, 'default'));
    this.encounter = pendingEncounter(s, this.mapId);
    if (this.encounter) {
      // somewhere along the paths, 9-14 steps away from the player, so the partner walks in on foot
      const f = w.flood(p.x, p.y, 16);
      const far = [...f.dist.entries()].filter(([, d]) => d >= 9 && d <= 14);
      const pick = far.length ? far[Math.floor(Math.random() * far.length)][0] : [...f.dist.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      if (pick === undefined) { this.encounter = null; return; }
      const sp = w.cellCenter(pick % f.w, Math.floor(pick / f.w));
      this.partner = makePartner(w, sp.x, sp.y);
      this.partner.active = false;   // walks in when the encounter starts
      return;
    }
    const spot = this.ecoSpot();
    if (spot) { this.partner = makePartner(w, spot.x, spot.y); this.partner.dir = 'e'; }
  }

  /** A standable cell next to the open Eco of this map that the player can actually walk to. */
  private ecoSpot(): { x: number; y: number } | null {
    const s = save(), w = this.world, p = w.player;
    const eco = this.portals.find(({ def }) => portalOpen(s, def) && !portalDone(s, def));
    if (!eco) return null;
    const f = w.flood(p.x, p.y, 200);
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const k of f.dist.keys()) {
      const c = w.cellCenter(k % f.w, Math.floor(k / f.w));
      const dx = c.x - eco.ent.x, dy = c.y - eco.ent.y;
      if (Math.abs(dx) < 40 && Math.abs(dy) < 30) continue;          // not on top of the portal
      if (Math.hypot(c.x - p.x, c.y - p.y) < 90) continue;            // nor on top of the player (spawn points are often next to the Ecos)
      const d = Math.hypot(dx + 70, dy - 6);                           // prefer its left side
      if (d < bd) { bd = d; best = c; }
    }
    return best && bd < 140 ? best : null;
  }

  /** Walks along the paths (never through walls). Falls back to appearing at the goal if there is no path. */
  private walk(e: Ent, x: number, y: number, face: Ent | null = null): Promise<void> {
    const pts = this.world.findPath(e.x, e.y, x, y);
    if (!pts || !pts.length) { e.x = x; e.y = y; if (face) this.world.faceTo(e, face); return Promise.resolve(); }
    return new Promise((res) => { e.move = { pts, i: 0, speed: 5, cb: res, face }; });
  }

  private async runEncounter(enc: Encounter): Promise<void> {
    const w = this.world, p = w.player, e = this.partner;
    if (!e) return;
    this.storyBusy = true;
    this.lock += 1;
    p.moving = false;
    e.active = true;
    // stop 4-5 steps away, ideally on the same row so both face each other without overlapping
    const f = w.flood(p.x, p.y, 6);
    let stop = { x: p.x, y: p.y }, bd = Infinity;
    for (const [k, d] of f.dist) {
      if (d < 4 || d > 5) continue;
      const c = w.cellCenter(k % f.w, Math.floor(k / f.w));
      if (Math.abs(c.x - p.x) < 60) continue;
      const score = Math.abs(c.y - p.y) * 3 + Math.hypot(c.x - e.x, c.y - e.y) * 0.2;
      if (score < bd) { bd = score; stop = c; }
    }
    await this.walk(e, stop.x, stop.y, p);
    w.faceTo(p, e);
    const s = save();
    for (const l of enc.lines(s.hero ?? 'aki', partnerOf())) await this.dialog.say(l);
    s.flags[`enc_${enc.id}`] = 1;
    commit();
    this.lock = Math.max(0, this.lock - 1);
    this.storyBusy = false;
    // then: wait next to the open Eco of this map, or walk away along the paths to keep searching
    const spot = this.ecoSpot();
    if (spot) { await this.walk(e, spot.x, spot.y); e.dir = 'e'; return; }
    const away = w.flood(e.x, e.y, 18);
    let goal: { x: number; y: number } | null = null, gd = -1;
    for (const [k, d] of away.dist) {
      if (d < 12) continue;
      const c = w.cellCenter(k % away.w, Math.floor(k / away.w));
      const fromPlayer = Math.hypot(c.x - p.x, c.y - p.y);
      if (fromPlayer > gd) { gd = fromPlayer; goal = c; }
    }
    if (goal) await this.walk(e, goal.x, goal.y);
    e.active = false;
  }

  private freeSpot(x: number, y: number): { x: number; y: number } {
    const w = this.world;
    for (let r = 0; r < 200; r += 16) {
      for (let a = 0; a < 8; a++) {
        const px = x + Math.cos(a * 0.785) * r, py = y + Math.sin(a * 0.785) * r;
        if (!w.blockedRect({ x: px - 40, y: py - 28, w: 80, h: 30 })) return { x: px, y: py };
      }
    }
    return { x, y };
  }

  private drawPortal(g: CanvasRenderingContext2D, def: PortalDef, sx: number, sy: number): void {
    const s = save();
    const open = portalOpen(s, def), done = portalDone(s, def);
    const t = this.world.time;
    // ground glow, then the swirling portal hovering a little above it (perspective squash for the top-down view)
    g.save();
    const gl = g.createRadialGradient(sx, sy, 2, sx, sy, 40);
    gl.addColorStop(0, done ? 'rgba(120,255,160,0.45)' : open ? 'rgba(120,200,255,0.5)' : 'rgba(160,160,170,0.25)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl; g.beginPath(); g.ellipse(sx, sy, 40, 14, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    visPortal(g, sx, sy - 30 + Math.sin(t * 2) * 1.5, done ? 14 : 22, t, { squash: 0.9, hue: done ? 135 : open ? 205 : -1, digits: open && !done, alpha: open || done ? 1 : 0.7 });
    const label = done ? `${def.name} (cerrado)` : open ? def.name : `${def.name} (sellado)`;
    pixOrText(g, label, sx, sy - 62, { size: 8, align: 'center', color: done ? '#9fffb8' : open ? '#c8f4ff' : '#c0b8b0', outline: '#000', spacing: 1 });
  }

  private startEco(def: PortalDef): void {
    if (this.storyBusy) return;
    const s = save();
    if (!portalOpen(s, def)) {
      this.storyBusy = true;
      const prev = def.level > 1 && s.pira.stars[def.level - 2] <= 0;
      void this.dialog.say(prev ? '[Flo] ¡Squawk! Este Eco todavía está sellado. Primero cerrá el Eco anterior.' : '[Consola: Quimerius] El Vis de este Eco aún es inestable. Avanza en tus estudios y vuelve más tarde.').then(() => { this.storyBusy = false; });
      return;
    }
    this.storyBusy = true;
    void (async () => {
      if (!portalDone(s, def)) for (const l of def.intro()) await this.dialog.say(l);
      await this.runLevel(def);
    })();
  }

  private async runLevel(def: PortalDef): Promise<void> {
    const lvl = await makeLevel(def.level, (r) => {
      this.lock = 0;
      void (async () => {
        if (r.won) {
          const first = !portalDone(save(), def);
          markLevel(def.level, r.stars, r.score, first ? def.reward : Math.round(def.reward / 3));
          if (first) for (const l of def.outro()) await this.dialog.say(l);
          await this.dialog.say(`[Consola: Quimerius] Eco cerrado: +${first ? def.reward : Math.round(def.reward / 3)} cristales, +${r.score} puntos. Ecos cerrados: ${closedEcos(save())}/5.`);
        }
        this.storyBusy = false;
        this.worldMusic();
      })();
    });
    this.lock = 1;
    await this.app.push(lvl);
  }

  /** Torneo de Campeones finished: show the result, then back to the world. */
  private tournamentEnd(): void {
    const s = save();
    const secs = Math.round((s.flags.tofcTime ?? 0) / 1000);
    s.crystals += 25; commit();
    this.storyBusy = true;
    void (async () => {
      await this.dialog.say(`[Luceria] ¡Felicitaciones, ${s.hero === 'pi' ? 'Pi' : 'Aki'}! Terminaste el Torneo de Campeones en ${Math.floor(secs / 60)} min ${secs % 60} s. Ganás 25 cristales.`);
      this.storyBusy = false;
      this.changeMap('woods', 'SPAWN_POINT_DUNGEON_EXIT');
    })();
  }

  private contact(e: Enemy): void {
    if (this.dueling || this.dialog.active) return;
    this.dueling = true;
    this.lock += 1;
    void this.app.push(new DuelScene(e.kind, (r) => {
      this.lock = Math.max(0, this.lock - 1);
      this.dueling = false;
      const s = save();
      if (r.won) { defeat(e); s.crystals += 2 + r.correct; s.score += 40 * r.correct; playSound('caza/objects/crystals/sounds/pickup.ogg', 0.6); }
      else { s.crystals = Math.max(0, s.crystals - 3); e.cooldown = 6; }
      commit();
    }));
  }

  private ctx(): HostCtx {
    return {
      world: this.world,
      say: (t) => this.dialog.say(t),
      choose: (q, o) => this.dialog.choose(q, o),
      changeMap: (m, s) => this.changeMap(m, s),
      openPuzzle: (id, cb) => this.openPuzzle(id, cb),
      lockInput: (on) => { this.lock += on ? 1 : -1; if (this.lock < 0) this.lock = 0; },
      goEnding: (cb) => { void import('./story').then((m) => this.app.goto(new m.FinaleScene())); void cb; },
      goTournamentEnding: () => { void import('./story').then(() => this.tournamentEnd()); },
      hero: () => save().hero ?? 'aki',
    };
  }

  changeMap(map: string, spawn: string): void {
    if (this.transition) return;
    this.transition = true;
    (save().flags as unknown as Record<string, string>).lastMap = map;
    (save().flags as unknown as Record<string, string>).lastSpawn = spawn;
    delete (save().flags as unknown as Record<string, unknown>).lastX;
    delete (save().flags as unknown as Record<string, unknown>).lastY;
    commit();
    this.app.goto(new CazaScene(map, spawn), undefined, 0.35);
  }

  openPuzzle(id: number, cb: LuaFunction | null): void {
    void import('../caza/puzzle').then(() => {
      const prevLock = this.lock;
      this.lock += 1;
      void this.app.push(new PuzzleScene(id, (res: PuzzleResult) => {
        this.lock = prevLock;
        if (res.correct && !this.mapId.startsWith('tower')) { save().crystals += 3; commit(); }
        if (cb) this.host.run(cb, [res.correct]);
      }));
    });
  }

  // ------------------------------------------------------------------ frame
  update(dt: number, app: App): void {
    if (!this.ready) return;
    this.time += dt;
    this.saveT += dt;
    const w = this.world;
    if (this.saveT > 6) {
      this.saveT = 0;
      const f = save().flags as unknown as Record<string, number | string>;
      f.lastMap = this.mapId; f.lastX = Math.round(w.player.x); f.lastY = Math.round(w.player.y);
      commit();
    }
    const p = w.player;
    this.host.update(dt);
    this.dialog.update(dt);
    const busy = this.dialog.active || this.lock > 0 || !!p.move;
    if (!busy) this.control(dt);
    else if (!p.move) p.moving = false;
    w.update(dt);
    if (!busy) updateEnemies(w, aliveEnemies(this.enemies), dt, (e) => this.contact(e));
    this.enemies = this.enemies.filter((e) => e.dead < 0.6 || (e.ent.active = false));
    this.triggers();
    if (this.encounter && !busy && !this.storyBusy && this.time > 0.8) { const enc = this.encounter; this.encounter = null; void this.runEncounter(enc); }
    if (!busy && isPressed('console')) void import('./consoleUi').then((m) => app.push(new m.ConsoleScene(this)));
    if (!busy && isPressed('back')) void import('./pause').then((m) => app.push(new m.PauseScene()));
  }

  private control(dt: number): void {
    const w = this.world, p = w.player;
    let dx = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0) + this.touchDir.x;
    let dy = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0) + this.touchDir.y;
    // pointer: hold on the map to walk toward it (mouse / touch)
    if (pointer.down && pointer.inside && !dx && !dy && pointer.y < H - 10) {
      const tx = w.camX + pointer.x / 2, ty = w.camY + pointer.y / 2;
      const ddx = tx - p.x, ddy = ty - (p.y - 30);
      if (Math.hypot(ddx, ddy) > 14) { dx = ddx; dy = ddy; }
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    p.moving = len > 0.05;
    if (p.moving) {
      const s = w.walkSpeed * dt * (isDown('alt') ? 1.6 : 1);
      p.moving = w.slideMove(p, dx * s, dy * s);   // slides around corners and stair edges
      if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'e' : 'w'; else if (Math.abs(dy) > 0.05) p.dir = dy > 0 ? 's' : 'n';
    }
  }

  private triggers(): void {
    const w = this.world, p = w.player;
    const pc = p.collider()!;
    const feet: Rect = { x: pc.x - 4, y: pc.y - 4, w: pc.w + 8, h: pc.h + 8 };
    this.prompt = '';
    const act = isPressed('act');
    let fired = false;
    for (const { def, ent } of this.portals) {
      if (Math.abs(ent.x - p.x) < 56 && Math.abs(ent.y - p.y) < 40) {
        this.prompt = portalOpen(save(), def) ? `Espacio: entrar al ${def.name}` : `${def.name} (sellado)`;
        if (act && !fired && !this.dialog.active && this.lock === 0 && !this.storyBusy) { fired = true; this.startEco(def); }
      }
    }
    for (const e of w.ents.values()) {
      if (e === p || !e.active || !e.placed || !e.def.trigger) continue;
      const r = e.triggerRect();
      if (!r) continue;
      // 'enter' zones use the exact feet (like the original engine): arriving next to a door must not fire it again;
      // 'action' prompts (talk / use) keep a small margin so they are easy to reach
      const inside = overlap(pc, r);
      const near = overlap(feet, r);
      if (inside && !e.overlapped && e.enter) this.host.fire(e, 'enter');
      if (near && e.action) {
        this.prompt = e.def.id.startsWith('npc') || e.def.id.startsWith('tri_door') ? 'Espacio: hablar / usar' : 'Espacio: usar';
        if (act && !fired && !this.dialog.active && this.lock === 0) { fired = true; this.host.fire(e, 'action'); }
      }
      e.overlapped = inside;
    }
  }

  render(g: CanvasRenderingContext2D): void {
    if (!this.ready) { g.fillStyle = '#05060f'; g.fillRect(0, 0, W, H); text(g, 'Cargando…', W / 2, H / 2, { align: 'center', size: 44, color: '#ffd873' }); return; }
    this.world.render(g);
    this.hud(g);
    this.dialog.render(g);
  }

  private hud(g: CanvasRenderingContext2D): void {
    const s = save();
    panel(g, 18, 14, 250, 62, 'rgba(10,12,24,0.7)', '#c9a24a');
    const cr = img('caza/objects/crystals/images/cristal01_a.png');
    if (cr) g.drawImage(cr, 30, 20, 46, 50);
    text(g, String(s.crystals), 90, 56, { size: 40, color: '#9fe8ff', weight: 700 });
    text(g, `${s.score} pts`, 250, 56, { size: 28, color: '#ffe066', align: 'right' });
    if (!COARSE) text(g, '[C] consola   [Esc] pausa', W - 20, 38, { size: 22, color: 'rgba(255,255,255,0.75)', align: 'right', outline: '#000' });
    if (this.prompt && !this.dialog.active) {
      panel(g, W / 2 - 200, H - 90, 400, 58, 'rgba(10,12,24,0.8)', '#c9a24a');
      text(g, this.prompt, W / 2, H - 52, { size: 28, align: 'center', color: '#f4eecc' });
    }
    void keyDown;
  }

  setTouchDir(x: number, y: number): void { this.touchDir = { x, y }; }
  playStep(): void { playSound('caza/objects/pc/sounds/pc_walk_default001.ogg', 0.2); }
}
