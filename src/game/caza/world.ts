// The Cazaproblemas world: tile maps with collision, entities (player, NPCs, pickups, static objects, trigger zones), trails,
// camera and rendering at 2x on the 1200x900 canvas (the original ran 600x450).
import { img, preload } from '../core/assets';
import { hasAsset, loadMap, solidAt, type EntDef, type MapDef, type TmxObject } from './data';
import { LuaTable, type LuaFunction } from './lua51';

export const VIEW_W = 600;
export const VIEW_H = 450;
export type Dir = 'n' | 'e' | 's' | 'w';
export interface Rect { x: number; y: number; w: number; h: number }

export interface Move { pts: { x: number; y: number }[]; i: number; speed: number; cb: (() => void) | null; face?: Ent | null }

export class Ent {
  x = 0;
  y = 0;
  dir: Dir = 's';
  active = true;
  placed = false;
  imageName = 'default';
  outfit = 'default';
  moving = false;
  animT = 0;
  move: Move | null = null;
  /** trigger rect for static zones (tri_*): absolute; null -> centered on the entity with def.trigger w/h */
  zone: Rect | null = null;
  overlapped = false;
  enter: LuaFunction | null = null;
  action: LuaFunction | null = null;
  triggerLoaded = false;
  tbl = new LuaTable();
  /** gliding hero sprite override (Pi): custom draw hook */
  custom: ((g: CanvasRenderingContext2D, e: Ent, sx: number, sy: number) => void) | null = null;
  speedMul = 1;
  /** blocks other characters (false for creatures, portals) */
  solid = true;
  constructor(readonly def: EntDef) {}
  get id(): string { return this.def.id; }
  get isPlayer(): boolean { return this.def.id === 'pc'; }
  triggerRect(): Rect | null {
    if (this.zone) return this.zone;
    const t = this.def.trigger;
    if (!t) return null;
    const w = t.w ?? 40, h = t.h ?? 40;
    return { x: this.x - w / 2, y: this.y - h / 2 - 10, w, h };
  }
  collider(): Rect | null {
    const c = this.def.collider;
    if (!c) return null;
    return { x: this.x + c.ox - c.w / 2, y: this.y + c.oy - c.h / 2, w: c.w, h: c.h };
  }
}

export const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class World {
  map!: MapDef;
  ents = new Map<string, Ent>();
  player!: Ent;
  camX = 0;
  camY = 0;
  camTarget: Ent | { x: number; y: number } | null = null;
  collision: Uint8Array | null = null;     // tile index +1 (0 = free)
  private tilesets: { first: number; img: string; cols: number }[] = [];
  private front: number[] = [];
  private back: number[] = [];
  walkSpeed = 118;
  time = 0;
  hooks: ((dt: number) => void)[] = [];
  /** hero sprite provider (Aki: original pc frames; Pi: remastered pirate) */
  heroDraw: ((g: CanvasRenderingContext2D, e: Ent, sx: number, sy: number) => void) | null = null;

  async load(mapId: string): Promise<void> {
    this.map = await loadMap(mapId);
    const j = this.map.json;
    this.tilesets = j.tilesets.map((t) => ({ first: t.first, img: 'caza/res/19px/' + t.image, cols: t.cols })).sort((a, b) => b.first - a.first);
    await preload(this.tilesets.filter((t) => !t.img.endsWith('collisions.png')).map((t) => t.img));
    // layers: <10 ground, >=10 drawn over everything; collisions
    this.back = []; this.front = [];
    j.layers.forEach((l, i) => {
      if (l.name === 'collisions') { this.buildCollision(l.data); return; }
      if (l.layer === null) return;
      (l.layer >= 10 ? this.front : this.back).push(i);
    });
    // entities
    this.ents.clear();
    const tmxObjs = new Map<string, TmxObject>((j.groups.objects ?? []).map((o) => [o.name, o]));
    const names = new Set<string>(this.map.order);
    for (const o of j.groups.objects ?? []) names.add(o.name);
    for (const id of names) {
      const def: EntDef = this.map.defs.get(id) ?? { id, images: [], outfits: [], sounds: {} };
      if (!def.images.length && !def.outfits.length) {
        const p = `caza/objects/${id}/images/${id}_default.png`;
        const p2 = `caza/objects/${id}/images/${id}.png`;
        const hit = [p, p2].find((q) => hasAsset(q));
        if (hit) def.images.push({ name: 'default', path: hit, def: true });
      }
      const e = new Ent(def);
      const o = tmxObjs.get(id);
      if (def.pos?.wp) { const wp = this.map.waypoints.get(def.pos.wp); if (wp) { e.x = wp.x; e.y = wp.y; e.placed = true; } }
      else if (def.pos?.x !== undefined) { e.x = def.pos.x; e.y = def.pos.y ?? 0; e.placed = true; }
      else if (o) { e.x = o.x + o.w / 2; e.y = o.y + o.h; e.placed = true; if (o.w > 0 && o.h > 0) e.zone = { x: o.x, y: o.y, w: o.w, h: o.h }; }
      if (def.images.length) e.imageName = (def.images.find((i) => i.def) ?? def.images[0]).name;
      if (!def.images.length && !def.outfits.length && !def.trigger && !def.sounds) continue;
      this.ents.set(id, e);
    }
    // preload entity pictures
    const paths: string[] = [];
    for (const e of this.ents.values()) { for (const im of e.def.images) paths.push(im.path); paths.push(...this.walkFrames(e.def)); }
    await preload(paths);
  }

  /** every standing / walking picture of a character (so animations never pop in half-loaded) */
  walkFrames(d: EntDef, outfit?: string): string[] {
    const out: string[] = [];
    for (const o of outfit ? [outfit] : d.outfits) {
      for (const dir of ['n', 'e', 's', 'w']) {
        out.push(`caza/objects/${d.id}/images/${d.id}_${o}_default_${dir}001.png`);
        for (let f = 1; f <= 8; f++) out.push(`caza/objects/${d.id}/images/${d.id}_${o}_walk_${dir}${String(f).padStart(3, '0')}.png`);
      }
    }
    return out;
  }

  private buildCollision(data: number[]): void {
    const j = this.map.json;
    const ts = j.tilesets.find((t) => t.name === 'collisions');
    const first = ts?.first ?? 1;
    this.collision = new Uint8Array(j.w * j.h);
    data.forEach((g, i) => { if (g) this.collision![i] = Math.max(1, Math.min(250, (g & 0x0fffffff) - first + 1)); });
  }

  /** Is the point (px,py) in the map blocked by the collision layer (or outside the map)? */
  blockedAt(px: number, py: number): boolean {
    const j = this.map.json;
    if (px < 0 || py < 0 || px >= j.w * j.tw || py >= j.h * j.th) return true;
    if (!this.collision) return false;
    const tx = Math.floor(px / j.tw), ty = Math.floor(py / j.th);
    const t = this.collision[ty * j.w + tx];
    if (!t) return false;
    return solidAt(t - 1, px - tx * j.tw, py - ty * j.th, j.tw);
  }

  blockedRect(r: Rect): boolean {
    const xs = [r.x + 0.5, r.x + r.w / 2, r.x + r.w - 0.5];
    const ys = [r.y + 0.5, r.y + r.h / 2, r.y + r.h - 0.5];
    for (const x of xs) for (const y of ys) if (this.blockedAt(x, y)) return true;
    return false;
  }

  blockedByEntity(e: Ent, r: Rect): boolean {
    for (const o of this.ents.values()) {
      if (o === e || !o.active || !o.placed || !o.solid) continue;
      const c = o.collider();
      if (c && overlap(r, c) && !(e.isPlayer && o.def.id === 'pc')) return true;
    }
    return false;
  }

  /** Move `e` by (dx,dy) sliding along walls and other colliders. */
  tryMove(e: Ent, dx: number, dy: number, ignoreEnts = false): boolean {
    const c = e.def.collider ?? { ox: 0, oy: -7, w: 52, h: 12 };
    const rectAt = (x: number, y: number): Rect => ({ x: x + c.ox - c.w / 2, y: y + c.oy - c.h / 2, w: c.w, h: c.h });
    let moved = false;
    if (dx) {
      const r = rectAt(e.x + dx, e.y);
      if (!this.blockedRect(r) && (ignoreEnts || !this.blockedByEntity(e, r))) { e.x += dx; moved = true; }
    }
    if (dy) {
      const r = rectAt(e.x, e.y + dy);
      if (!this.blockedRect(r) && (ignoreEnts || !this.blockedByEntity(e, r))) { e.y += dy; moved = true; }
    }
    return moved;
  }

  // ------------------------------------------------------------------ walkable grid (one cell per tile), used to place and route NPCs
  /** Can a character's feet stand at (x, y)? Slightly smaller than the player's collider so narrow paths still count. */
  standable(x: number, y: number): boolean {
    return !this.blockedRect({ x: x - 18, y: y - 12, w: 36, h: 10 });
  }
  private cellOf(x: number, y: number): [number, number] {
    const j = this.map.json;
    return [Math.floor(x / j.tw), Math.floor(y / j.th)];
  }
  cellCenter(cx: number, cy: number): { x: number; y: number } {
    const j = this.map.json;
    return { x: (cx + 0.5) * j.tw, y: (cy + 0.5) * j.th };
  }
  /** Nearest standable cell to (x, y) (spiral search), or null. */
  nearestCell(x: number, y: number, radius = 6): [number, number] | null {
    const [cx, cy] = this.cellOf(x, y);
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c = this.cellCenter(cx + dx, cy + dy);
        if (this.standable(c.x, c.y)) return [cx + dx, cy + dy];
      }
    }
    return null;
  }
  /**
   * Breadth-first flood over standable cells from (x, y): returns walking distance (in cells) and parent links,
   * keyed by cy * w + cx. Only cells really connected to the start are included, so nothing spawns behind walls or roofs.
   */
  flood(x: number, y: number, maxDist = 60): { dist: Map<number, number>; parent: Map<number, number>; w: number } {
    const j = this.map.json;
    const dist = new Map<number, number>(), parent = new Map<number, number>();
    const start = this.nearestCell(x, y);
    if (!start) return { dist, parent, w: j.w };
    const k0 = start[1] * j.w + start[0];
    dist.set(k0, 0);
    const q = [k0];
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi], d = dist.get(k)!;
      if (d >= maxDist) continue;
      const cx = k % j.w, cy = Math.floor(k / j.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= j.w || ny >= j.h) continue;
        const nk = ny * j.w + nx;
        if (dist.has(nk)) continue;
        const c = this.cellCenter(nx, ny);
        if (!this.standable(c.x, c.y)) continue;
        dist.set(nk, d + 1); parent.set(nk, k); q.push(nk);
      }
    }
    return { dist, parent, w: j.w };
  }
  /** Walkable path (cell centers, turning points only) from (x0, y0) to the cell nearest (x1, y1), or null. */
  findPath(x0: number, y0: number, x1: number, y1: number, maxDist = 90): { x: number; y: number }[] | null {
    const target = this.nearestCell(x1, y1);
    if (!target) return null;
    const f = this.flood(x0, y0, maxDist);
    let k = target[1] * f.w + target[0];
    if (!f.dist.has(k)) return null;
    const cells: number[] = [];
    while (k !== undefined) { cells.push(k); const p = f.parent.get(k); if (p === undefined) break; k = p; }
    cells.reverse();
    const pts = cells.map((c) => this.cellCenter(c % f.w, Math.floor(c / f.w)));
    // keep only the corners so the walk looks natural
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      if (!a || !c || (b.x - a.x) * (c.y - b.y) !== (b.y - a.y) * (c.x - b.x)) out.push(b);
    }
    return out;
  }

  waypoint(name: string): { x: number; y: number } | null {
    return this.map.waypoints.get(name) ?? null;
  }
  trail(name: string): { x: number; y: number }[] | null {
    const t = this.map.trails.get(name);
    if (!t) return null;
    return t.map((w) => this.map.waypoints.get(w)).filter((p): p is { x: number; y: number } => !!p);
  }

  // ------------------------------------------------------------------ update
  update(dt: number): void {
    this.time += dt;
    for (const e of this.ents.values()) {
      if (!e.active) continue;
      if (e.move) this.stepMove(e, dt);
      else if (!e.isPlayer) e.moving = false;   // the player's flag is owned by the input code
      if (e.moving) e.animT += dt;
    }
    for (const h of this.hooks) h(dt);
    this.updateCamera(dt);
  }

  private stepMove(e: Ent, dt: number): void {
    const m = e.move!;
    const speed = this.walkSpeed * (m.speed / 5) * e.speedMul;
    let left = speed * dt;
    e.moving = false;
    while (left > 0 && m.i < m.pts.length) {
      const p = m.pts[m.i];
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= left) {
        e.x = p.x; e.y = p.y; left -= d; m.i++;
        if (d > 0.5) { e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n'; e.moving = true; }
      } else {
        e.x += (dx / d) * left; e.y += (dy / d) * left; left = 0; e.moving = true;
        e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
      }
    }
    if (m.i >= m.pts.length) {
      e.move = null;
      e.moving = false;
      if (m.face) this.faceTo(e, m.face);
      m.cb?.();
    }
  }

  faceTo(e: Ent, t: { x: number; y: number }): void {
    const dx = t.x - e.x, dy = t.y - e.y;
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  }

  private updateCamera(dt: number): void {
    const j = this.map.json;
    const t = this.camTarget ?? this.player;
    if (!t) return;
    const tx = t.x - VIEW_W / 2, ty = t.y - 60 - VIEW_H / 2;
    const k = 1 - Math.pow(0.0005, dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.clampCam(j.w * j.tw, j.h * j.th);
  }
  snapCamera(): void {
    const t = this.camTarget ?? this.player;
    const j = this.map.json;
    if (!t) return;
    this.camX = t.x - VIEW_W / 2;
    this.camY = t.y - 60 - VIEW_H / 2;
    this.clampCam(j.w * j.tw, j.h * j.th);
  }
  private clampCam(mw: number, mh: number): void {
    this.camX = mw <= VIEW_W ? (mw - VIEW_W) / 2 : Math.max(0, Math.min(mw - VIEW_W, this.camX));
    this.camY = mh <= VIEW_H ? (mh - VIEW_H) / 2 : Math.max(0, Math.min(mh - VIEW_H, this.camY));
  }

  // ------------------------------------------------------------------ render (canvas scaled x2)
  render(g: CanvasRenderingContext2D, scale = 2): void {
    const j = this.map.json;
    g.save();
    g.scale(scale, scale);
    g.fillStyle = '#10121c';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const cx = Math.round(this.camX), cy = Math.round(this.camY);
    g.translate(-cx, -cy);
    for (const li of this.back) this.drawLayer(g, li, cx, cy);
    const list = [...this.ents.values()].filter((e) => e.active && e.placed && (e.def.images.length || e.def.outfits.length || e.custom));
    list.sort((a, b) => a.y - b.y);
    for (const e of list) this.drawEnt(g, e);
    for (const li of this.front) this.drawLayer(g, li, cx, cy);
    g.restore();
    void j;
  }

  private drawLayer(g: CanvasRenderingContext2D, li: number, cx: number, cy: number): void {
    const j = this.map.json;
    const data = j.layers[li].data;
    const tw = j.tw, th = j.th;
    const x0 = Math.max(0, Math.floor(cx / tw)), x1 = Math.min(j.w - 1, Math.floor((cx + VIEW_W) / tw));
    const y0 = Math.max(0, Math.floor(cy / th)), y1 = Math.min(j.h - 1, Math.floor((cy + VIEW_H) / th) + 1);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const gid = data[ty * j.w + tx] & 0x0fffffff;
        if (!gid) continue;
        const ts = this.tilesets.find((t) => t.first <= gid);
        if (!ts) continue;
        const im = img(ts.img);
        if (!im) continue;
        const k = gid - ts.first;
        g.drawImage(im, (k % ts.cols) * tw, Math.floor(k / ts.cols) * th, tw, th, tx * tw, ty * th, tw, th);
      }
    }
  }

  frameImage(e: Ent): CanvasImageSource | null {
    const d = e.def;
    if (e.custom) return null;
    if (d.outfits.length) {
      const outfit = d.outfits.includes(e.outfit) ? e.outfit : d.outfits[0];
      const dirKey = e.dir;
      if (e.moving) {
        const f = (Math.floor(e.animT * 12) % 8) + 1;
        const im = img(`caza/objects/${d.id}/images/${d.id}_${outfit}_walk_${dirKey}${String(f).padStart(3, '0')}.png`);
        if (im) return im;
      }
      return img(`caza/objects/${d.id}/images/${d.id}_${outfit}_default_${dirKey}001.png`);
    }
    const im = d.images.find((i) => i.name === e.imageName) ?? d.images.find((i) => i.def) ?? d.images[0];
    return im ? img(im.path) : null;
  }

  private drawEnt(g: CanvasRenderingContext2D, e: Ent): void {
    const sx = Math.round(e.x), sy = Math.round(e.y);
    if (e.custom) { e.custom(g, e, sx, sy); return; }
    const im = this.frameImage(e);
    if (!im) return;
    const w = (im as HTMLImageElement).naturalWidth ?? (im as HTMLCanvasElement).width;
    const h = (im as HTMLImageElement).naturalHeight ?? (im as HTMLCanvasElement).height;
    g.drawImage(im, sx - w / 2, sy - h);
  }
}
