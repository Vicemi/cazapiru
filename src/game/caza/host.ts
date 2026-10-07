// Lua host: the global API the original data scripts were written against (Dialog, Trigger, Map, Camera, get_entity, player,
// change_map, open_puzzle, wait, ...), implemented on top of World / DialogUI / save. Scripts are the original compiled Lua.
import { bytes } from '../core/assets';
import { playSound } from '../core/audio';
import { hasAsset } from './data';
import { LuaTable, LuaError, Thread, Yield, load, closureOf, stdlib, setGlobals, callFn, type LuaFunction, type LuaValue, type Proto, tostr } from './lua51';
import type { Ent, World } from './world';
import { save, commit } from '../save';

export interface HostCtx {
  world: World;
  /** show one dialog page (resolves when dismissed) */
  say(text: string): Promise<void>;
  choose(question: string, options: string[]): Promise<number>;
  changeMap(map: string, spawn: string): void;
  openPuzzle(id: number, cb: LuaFunction | null): void;
  lockInput(on: boolean): void;
  /** story hooks implemented outside the Lua scripts */
  goEnding(cb: LuaFunction | null): void;
  goTournamentEnding(): void;
  hero(): 'aki' | 'pi';
}

const scriptCache = new Map<string, Proto>();

export async function preloadScripts(extra: string[] = []): Promise<void> {
  const need = [...extra];
  // every .lua shipped by build_caza.py (small): fetch them all once
  const man = (await (await fetch('/assets/caza/manifest.json')).json()) as string[];
  for (const p of man) if (p.endsWith('.lua')) need.push('caza/' + p);
  await Promise.all([...new Set(need)].map(async (p) => {
    if (scriptCache.has(p)) return;
    const b = await bytes(p);
    if (b) { try { scriptCache.set(p, load(b)); } catch (e) { console.warn('lua load failed', p, e); } }
  }));
}

export const script = (path: string): Proto | undefined => scriptCache.get(path);

interface Waiter { th: Thread; done?: () => void }

export class LuaHost {
  g = new LuaTable();
  player = new LuaTable();
  private threads: Waiter[] = [];
  private timers: { t: number; fn: LuaFunction }[] = [];
  private triggerTable = new LuaTable();
  private mapTable = new LuaTable();
  private cameraTable = new LuaTable();
  private dialogTable = new LuaTable();
  private entWrap = new Map<string, LuaTable>();
  private ctxRef!: HostCtx;
  private mapEnt = new LuaTable();

  constructor() {
    stdlib(this.g);
    setGlobals(this.g);
  }

  get ctx(): HostCtx { return this.ctxRef; }
  attach(ctx: HostCtx): void { this.ctxRef = ctx; setGlobals(this.g); this.install(); }

  // ------------------------------------------------------------------ state sync (Lua globals <-> save)
  private syncIn(): void {
    const s = save();
    this.g.set('currentTier', s.tier);
    this.player.set('coins', s.crystals);
  }
  private syncOut(): void {
    const s = save();
    const t = this.g.get('currentTier');
    if (typeof t === 'number') s.tier = t;
    const c = this.player.get('coins');
    if (typeof c === 'number') s.crystals = Math.max(0, Math.floor(c));
  }

  /** Run a Lua function as a thread (it may block on dialogs); returns when it first yields or finishes. */
  run(fn: LuaFunction | null | undefined, args: LuaValue[] = [], done?: () => void): void {
    if (!fn) { done?.(); return; }
    const w: Waiter = { th: new Thread(fn, args), done };
    this.advance(w, []);
  }

  private depth = 0;
  private advance(w: Waiter, resume: LuaValue[]): void {
    // Lua globals <-> save are synchronised once per outermost entry (nested runs share the state)
    setGlobals(this.g);
    if (this.depth === 0) this.syncIn();
    this.depth++;
    let r;
    try { r = w.th.step(resume); } catch (e) { console.error('[lua error]', e); this.depth--; if (this.depth === 0) this.syncOut(); return; }
    this.depth--;
    if (this.depth === 0) this.syncOut();
    if (r.done) { w.done?.(); return; }
    const tag = r.tag as { kind: string; text?: string; q?: string; opts?: string[] };
    if (tag.kind === 'line') void this.ctx.say(tag.text!).then(() => this.advance(w, []));
    else if (tag.kind === 'options') void this.ctx.choose(tag.q!, tag.opts!).then((i) => this.advance(w, [i]));
  }

  update(dt: number): void {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      this.timers[i].t -= dt * 1000;
      if (this.timers[i].t <= 0) { const t = this.timers.splice(i, 1)[0]; this.run(t.fn); }
    }
  }

  // ------------------------------------------------------------------ scripts
  runChunk(path: string): boolean {
    const p = script(path);
    if (!p) return false;
    this.run(closureOf(p));
    return true;
  }

  /** Load a map script: it defines Map.load (called afterwards). */
  loadMapScript(mapId: string): void {
    this.mapTable.hash.clear();
    const p = script(`caza/maps/${mapId}.lua`);
    if (!p) return;
    this.run(closureOf(p));
  }
  runMapLoad(): void { const f = this.mapTable.get('load'); if (f) this.run(f as LuaFunction); }

  /** Execute an entity's trigger script and capture Trigger.enter / Trigger.action. */
  attachTrigger(e: Ent): void {
    const d = e.def.trigger;
    if (!d || e.triggerLoaded) return;
    e.triggerLoaded = true;
    const base = d.file.startsWith('caza/') ? d.file : '';
    const folderId = hasAsset(`caza/objects/${e.def.id}/triggers/${e.def.id}_trigger.lua`) ? e.def.id : e.def.type ?? e.def.id;
    const candidates = [base, `caza/objects/${folderId}/triggers/${folderId}_trigger.lua`, `caza/objects/${e.def.id}/triggers/${e.def.id}_trigger.lua`, 'caza/objects/maps/triggers/tri_door_generic_trigger.lua'].filter(Boolean);
    let p: Proto | undefined;
    for (const c of candidates) { p = script(c); if (p) break; }
    if (!p) return;
    setGlobals(this.g);
    const t = new LuaTable();
    this.g.set('Trigger', t);
    this.syncIn();
    try { new Thread(closureOf(p), []).step(); } catch (er) { console.error('[lua trigger]', e.id, er); }
    this.g.set('Trigger', this.triggerTable);
    const self = this.wrap(e);
    const mk = (f: LuaValue): LuaFunction | null => (f ? (f as LuaFunction) : null);
    e.enter = mk(t.get('enter'));
    e.action = mk(t.get('action'));
    // the trigger component passed as `self`: .parent = entity wrapper, :remove_from_game()
    const comp = new LuaTable();
    comp.set('parent', self);
    comp.set('remove_from_game', () => { e.enter = null; e.action = null; });
    comp.set('name', e.id);
    e.tbl.set('__trigger', comp);
  }

  fire(e: Ent, kind: 'enter' | 'action'): void {
    const f = kind === 'enter' ? e.enter : e.action;
    if (!f) return;
    const comp = e.tbl.get('__trigger');
    this.run(f, [comp]);
  }

  // ------------------------------------------------------------------ entity wrappers
  wrap(e: Ent): LuaTable {
    let w = this.entWrap.get(e.id);
    if (w) return w;
    w = e.tbl;
    this.entWrap.set(e.id, w);
    const world = () => this.ctx.world;
    w.set('name', e.id);
    w.set('id', e.id);
    w.set('add_to_game', () => { e.active = true; });
    w.set('remove_from_game', () => { e.active = false; });
    const mv = new LuaTable();
    mv.set('parent', w);
    mv.set('set_position', (_s, p) => {
      const wp = typeof p === 'string' ? world().waypoint(p) : null;
      if (wp) { e.x = wp.x; e.y = wp.y; e.placed = true; e.move = null; }
      else if (p instanceof LuaTable) { e.x = Number(p.get('x') ?? e.x); e.y = Number(p.get('y') ?? e.y); e.placed = true; }
    });
    mv.set('move', (_s, target, speed, cb) => {
      const pts = typeof target === 'string' ? world().trail(target) ?? (world().waypoint(target) ? [world().waypoint(target)!] : null) : null;
      if (!pts) { if (cb) this.run(cb as LuaFunction); return; }
      e.move = { pts: pts.map((p) => ({ ...p })), i: 0, speed: typeof speed === 'number' ? speed : 5, cb: cb ? () => this.run(cb as LuaFunction) : null };
    });
    mv.set('face', (_s, target, _speed, cb) => {
      const t = target instanceof LuaTable ? this.entOf(target) : null;
      if (t) world().faceTo(e, t);
      if (cb) this.run(cb as LuaFunction);
    });
    mv.set('is_moving', () => !!e.move);
    w.set('movement', mv);
    const snd = new LuaTable();
    snd.set('play', (_s, name, loop, cb) => {
      const n = String(name);
      const def = e.def.sounds[n];
      if (def) playSound(def.path, def.volume);
      else {
        const path = this.soundPath(n);
        if (path) playSound(path, 0.6);
      }
      if (cb) this.run(cb as LuaFunction);
    });
    w.set('sounds', snd);
    const rd = new LuaTable();
    rd.set('set_image', (_s, name) => { e.imageName = String(name); });
    w.set('render', rd);
    w.set('get_component', (_s, name) => w!.get(String(name)));
    return w;
  }

  private soundPath(name: string): string | null {
    const cands = [`caza/objects/maps/sounds/${name}.ogg`, `caza/sounds/${name}.ogg`];
    return cands.find((c) => hasAsset(c)) ?? null;
  }

  private entOf(t: LuaTable): Ent | null {
    const id = t.get('id');
    if (typeof id !== 'string') return null;
    return this.ctx.world.ents.get(id) ?? null;
  }

  // ------------------------------------------------------------------ globals
  private install(): void {
    const g = this.g;
    const w = () => this.ctx.world;
    const s = () => save();
    // Dialog
    const D = this.dialogTable;
    D.set('line', (_s, text) => new Yield({ kind: 'line', text: tostr(text ?? null) }));
    D.set('options', (_s, q, opts) => {
      const arr: string[] = [];
      const t = opts as LuaTable;
      for (let i = 1; i <= t.length(); i++) arr.push(tostr(t.get(i)));
      return new Yield({ kind: 'options', q: tostr(q ?? null), opts: arr });
    });
    D.set('start', (id, cb) => {
      const p = script(`caza/dialogs/scripts/${String(id)}.lua`);
      if (!p) { console.warn('missing dialog', id); if (cb) this.run(cb as LuaFunction); return; }
      this.ctx.lockInput(true);
      const prevDialog = this.g.get('Dialog');
      this.g.set('Dialog', D);
      this.run(closureOf(p), [], () => {
        this.ctx.lockInput(false);
        if (cb) this.run(cb as LuaFunction);
      });
      void prevDialog;
    });
    g.set('Dialog', D);
    g.set('Trigger', this.triggerTable);
    g.set('Map', this.mapTable);
    const C = this.cameraTable;
    C.set('follow_player', () => { w().camTarget = null; });
    C.set('follow_pos', (wp) => { const p = w().waypoint(String(wp)); if (p) w().camTarget = p; });
    g.set('Camera', C);
    g.set('get_entity', (id) => {
      const key = String(id);
      if (key === 'map') return this.mapEnt;
      const e = w().ents.get(key);
      return e ? this.wrap(e) : null;
    });
    // the map pseudo-entity: ambient sounds
    const mapSnd = new LuaTable();
    mapSnd.set('play', (_s, name, loop, cb) => {
      const n = String(name);
      const p = this.soundPath(n) ?? this.soundPath(n.replace(/_ambient$/, '_1'));
      if (p) playSound(p, 0.35);
      if (cb) this.run(cb as LuaFunction);
    });
    this.mapEnt.set('sounds', mapSnd);
    g.set('wait', (ms, fn) => { this.timers.push({ t: Number(ms), fn: fn as LuaFunction }); });
    g.set('change_map', (m, sp) => this.ctx.changeMap(String(m), String(sp)));
    g.set('open_puzzle', (id, cb) => this.ctx.openPuzzle(Number(id), (cb as LuaFunction) ?? null));
    g.set('get_year', () => s().flags.year ?? 5);
    g.set('print', () => undefined);
    g.set('reset_score', () => { s().score = 0; });
    g.set('timer_start', () => { s().flags.tofcStart = Date.now(); });
    g.set('timer_end', () => { s().flags.tofcTime = Date.now() - (s().flags.tofcStart ?? Date.now()); });
    g.set('go_to_ending', (cb) => this.ctx.goEnding((cb as LuaFunction) ?? null));
    g.set('go_to_tofc_ending', () => this.ctx.goTournamentEnding());
    g.set('go_to_register', () => undefined);
    g.set('ceibal_register_test', false);
    g.set('dofile', (path) => { const p = script('caza/' + String(path).replace(/^data\//, '')); if (p) this.run(closureOf(p)); });
    // houses (class attempts per tower: ten digits)
    g.set('get_houses', () => (s().flags.houses !== undefined ? String(s().flags.houses).padStart(10, '0') : '0000000000'));
    g.set('set_houses', (v) => { s().flags.houses = Number(String(v)); });
    // townfolk puzzle chains
    this.installTown();
    // player
    const P = this.player;
    this.entWrap.set('pc', P);
    P.set('id', 'pc'); P.set('name', 'pc');
    P.set('has_item', (_s, n) => s().items.includes(String(n)));
    P.set('add_item', (_s, n) => { const k = String(n); if (!s().items.includes(k)) s().items.push(k); });
    P.set('remove_item', (_s, n) => { s().items = s().items.filter((i) => i !== String(n)); });
    const pmv = new LuaTable();
    pmv.set('move', (_s, target, speed, cb) => {
      const pe = w().player;
      const pts = typeof target === 'string' ? w().trail(target) ?? (w().waypoint(target) ? [w().waypoint(target)!] : null) : null;
      if (!pts) { if (cb) this.run(cb as LuaFunction); return; }
      pe.move = { pts: pts.map((p) => ({ ...p })), i: 0, speed: typeof speed === 'number' ? speed : 5, cb: cb ? () => this.run(cb as LuaFunction) : null };
    });
    pmv.set('set_position', (_s, p) => { const wp = w().waypoint(String(p)); if (wp) { w().player.x = wp.x; w().player.y = wp.y; } });
    pmv.set('face', () => undefined);
    P.set('movement', pmv);
    P.set('get_component', (_s, name) => P.get(String(name)));
    g.set('player', P);
    this.syncIn();
  }

  // ------------------------------------------------------------------ townfolk puzzle chains (C++ side of the original)
  private townState(): { assigned: Record<string, number>; active: string[]; done: string[]; last: string } {
    const f = save().flags as unknown as Record<string, unknown>;
    if (!f.town) f.town = { assigned: {}, active: [], done: [], last: '' };
    return f.town as { assigned: Record<string, number>; active: string[]; done: string[]; last: string };
  }

  private installTown(): void {
    const g = this.g;
    const T = () => this.townState();
    g.set('get_puzzle', (name) => T().assigned[String(name)] ?? 0);
    g.set('set_location', (name, pid) => {
      const t = T(); const n = String(name);
      t.assigned[n] = Number(pid);
      if (!t.active.includes(n)) t.active.push(n);
      t.last = n;
    });
    g.set('is_active', (name) => T().active.includes(String(name)));
    g.set('last_active', () => T().last || null);
    g.set('executed_all', () => {
      const loc = g.get('locations');
      // the full bank is 36 towns; the story needs the first 16 (it unlocks every gate of the original)
      return loc instanceof LuaTable && T().done.length >= Math.min(16, loc.length());
    });
    // played: the NPC stops being active (set_next_location in game_init.lua then activates the next town in the chain)
    const origSetNext = () => g.get('set_next_location');
    g.set('mark_played', (name) => { const t = T(); const n = String(name); t.active = t.active.filter((a) => a !== n); if (!t.done.includes(n)) t.done.push(n); });
    void origSetNext;
  }

  /** Called once before the first map: runs data.lua / game_init.lua and seeds the chains. */
  boot(): void {
    this.syncIn();
    this.runChunk('caza/game_init.lua');
    this.runChunk('caza/tiers.lua');
    // game_init's set_next_location also retires the NPC whose puzzle is being played (C++ side of the original)
    const orig = this.g.get('set_next_location');
    if (orig) {
      this.g.set('set_next_location', (name, p) => {
        (this.g.get('mark_played') as (n: LuaValue) => void)(name ?? null);
        return callFn(orig as LuaFunction, [name ?? null, p ?? null])[0] ?? null;
      });
    }
    commit();
  }
}

export { LuaError };
