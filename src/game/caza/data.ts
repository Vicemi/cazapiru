// Cazaproblemas data model: maps (TMX -> JSON), object definitions (map .xml -> JSON), trails, collision shapes.
import { json } from '../core/assets';

export interface XNode { t: string; a?: Record<string, string>; c?: XNode[]; x?: string }

export interface TileSet { first: number; name: string; image: string; cols: number }
export interface TmxObject { name: string; type?: string | null; x: number; y: number; w: number; h: number; props: Record<string, string>; pts?: number[][] }
export interface MapJson {
  w: number; h: number; tw: number; th: number;
  tilesets: TileSet[];
  tileprops: Record<string, Record<string, string>>;
  layers: { name: string; layer: number | null; data: number[] }[];
  groups: Record<string, TmxObject[]>;
}

export interface EntDef {
  id: string;
  type?: string;
  collider?: { ox: number; oy: number; w: number; h: number };
  images: { name: string; path: string; def: boolean }[];
  /** outfits that have walking animations (frames follow the file naming of the original) */
  outfits: string[];
  pos?: { wp?: string; x?: number; y?: number };
  trigger?: { file: string; w?: number; h?: number };
  sounds: Record<string, { path: string; volume: number }>;
  pickup?: { positions: string[] };
  pushable?: boolean;
}

export interface MapDef {
  id: string;
  json: MapJson;
  defs: Map<string, EntDef>;
  order: string[];
  trails: Map<string, string[]>;
  waypoints: Map<string, { x: number; y: number }>;
  dialogs: string[];
  hasPc: boolean;
}

const mapCache = new Map<string, Promise<MapDef>>();
let templates: Map<string, XNode> | null = null;

async function loadTemplates(): Promise<Map<string, XNode>> {
  if (templates) return templates;
  const root = await json<XNode>('caza/objects.xml.json');
  templates = new Map((root.c ?? []).map((n) => [n.t, n]));
  return templates;
}

const kids = (n: XNode | undefined, t: string): XNode[] => (n?.c ?? []).filter((c) => c.t === t);
const kid = (n: XNode | undefined, t: string): XNode | undefined => (n?.c ?? []).find((c) => c.t === t);
const dataPath = (p: string): string => 'caza/' + p.replace(/^data\//, '');

/** Merge a template node (objects.xml, by `type`) under the instance node: the instance wins per child tag. */
function merge(inst: XNode, tpl: XNode | undefined): XNode {
  if (!tpl) return inst;
  const have = new Set((inst.c ?? []).map((c) => c.t));
  return { ...inst, c: [...(inst.c ?? []), ...(tpl.c ?? []).filter((c) => !have.has(c.t))] };
}

let manifest: Set<string> | null = null;
export async function loadManifest(): Promise<Set<string>> {
  if (!manifest) manifest = new Set((await json<string[]>('caza/manifest.json')).map((p) => 'caza/' + p));
  return manifest;
}
export const hasAsset = (p: string): boolean => !!manifest?.has(p);

export function parseDef(node: XNode, tpls: Map<string, XNode>): EntDef {
  const n = merge(node, node.a?.type ? tpls.get(node.a.type) : undefined);
  const id = n.a!.id;
  const type = n.a?.type;
  const def: EntDef = { id, type, images: [], outfits: [], sounds: {} };
  const col = kid(n, 'collidable');
  const shape = kid(col, 'shape');
  if (col && shape) def.collider = { ox: +(col.a?.x ?? 0), oy: +(col.a?.y ?? 0), w: +shape.a!.width, h: +shape.a!.height };
  const resolve = (name: string): string => {
    const cands = [`caza/objects/${id}/images/${id}_${name}.png`, type ? `caza/objects/${type}/images/${id}.png` : '', type ? `caza/objects/${type}/images/${id}_${name}.png` : '', `caza/objects/${id}/images/${id}.png`];
    return cands.find((c) => c && hasAsset(c)) ?? cands[0];
  };
  for (const im of kids(kid(kid(n, 'render'), 'images'), 'image')) {
    const name = im.a?.name ?? 'default';
    def.images.push({ name, path: im.a?.path ? dataPath(im.a.path) : resolve(name), def: im.a?.default === 'true' });
  }
  if (!def.images.length) {
    const p = resolve('default');
    if (hasAsset(p)) def.images.push({ name: 'default', path: p, def: true });
  }
  for (const o of kid(kid(n, 'animations'), 'outfits')?.c ?? []) def.outfits.push(o.t);
  const pos = kid(n, 'position');
  if (pos) def.pos = { wp: pos.a?.waypoint, x: pos.a?.x ? +pos.a.x : undefined, y: pos.a?.y ? +pos.a.y : undefined };
  const trig = kid(n, 'trigger');
  if (trig) def.trigger = { file: trig.a?.path ? dataPath(trig.a.path) : trig.a?.file ?? 'trigger.lua', w: trig.a?.width ? +trig.a.width : undefined, h: trig.a?.height ? +trig.a.height : undefined };
  for (const sn of kids(kid(n, 'sounds'), 'sound')) def.sounds[sn.a!.name] = { path: dataPath(sn.a!.path), volume: +(sn.a?.volume ?? 1) };
  const pk = kid(n, 'pickup');
  if (pk) def.pickup = { positions: kids(kid(pk, 'positions'), 'position').map((q) => dataPath(q.a!.path)) };
  if (kid(n, 'pushable')) def.pushable = true;
  return def;
}

export function loadMap(id: string): Promise<MapDef> {
  let p = mapCache.get(id);
  if (!p) {
    p = (async () => {
      await loadManifest();
      const [mj, xml, tpls] = await Promise.all([json<MapJson>(`caza/maps/${id}.map.json`), json<XNode>(`caza/maps/${id}.xml.json`).catch(() => ({ t: 'map' } as XNode)), loadTemplates()]);
      const defs = new Map<string, EntDef>();
      const order: string[] = [];
      for (const o of kids(kid(xml, 'objects'), 'object')) { const d = parseDef(o, tpls); defs.set(d.id, d); order.push(d.id); }
      const trails = new Map<string, string[]>();
      for (const t of kids(kid(xml, 'trails'), 'trail')) trails.set(t.a!.name, kids(t, 'waypoint').map((w) => w.a!.name));
      const waypoints = new Map<string, { x: number; y: number }>();
      for (const w of mj.groups.waypoints ?? []) waypoints.set(w.name, { x: w.x, y: w.y });
      const dialogs = (kid(xml, 'dialogs')?.c ?? []).map((d) => d.t);
      return { id, json: mj, defs, order, trails, waypoints, dialogs, hasPc: !!kid(xml, 'pc') } as MapDef;
    })();
    mapCache.set(id, p);
  }
  return p;
}

/** Collision tiles (collisions.png): 0 full, 1/2 = left/right half of an upward triangle, 3/4 = left/right half of a downward one. */
export function solidAt(tile: number, px: number, py: number, tw: number): boolean {
  const x = px, y = py;
  switch (tile) {
    case 0: return true;
    case 1: return y >= tw - x;
    case 2: return y >= x;
    case 3: return y <= x;
    case 4: return y <= tw - x;
    default: return true;
  }
}
