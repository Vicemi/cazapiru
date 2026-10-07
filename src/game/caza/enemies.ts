// Creatures of the Sea of Numbers that fell into Terragrifus (Piracálculos sprites living in the Cazaproblemas world).
import { img } from '../core/assets';
import { playSound } from '../core/audio';
import { Ent, type World } from './world';
import type { EnemyKind } from './duel';

const C = 'pira/images/characters/';

export interface Enemy { ent: Ent; kind: EnemyKind; home: { x: number; y: number }; tx: number; ty: number; wait: number; cooldown: number; bone: { x: number; y: number; vx: number; vy: number; t: number } | null; boneT: number; dead: number; hop: number }

const SPEED: Record<EnemyKind, number> = { dado: 48, calavera: 0, ronca: 22, sabio: 0 };

export function spawnEnemies(world: World, n: number): Enemy[] {
  const out: Enemy[] = [];
  // only cells connected on foot to the player: creatures never appear behind walls, on roofs or inside closed areas
  const f = world.flood(world.player.x, world.player.y, 220);
  const cells = [...f.dist.entries()].filter(([, d]) => d >= 14).map(([k]) => world.cellCenter(k % f.w, Math.floor(k / f.w)));
  if (!cells.length) return out;
  let tries = 0;
  const kinds: EnemyKind[] = ['dado', 'calavera', 'ronca'];
  while (out.length < n && tries++ < 400) {
    const c = cells[Math.floor(Math.random() * cells.length)];
    const x = c.x, y = c.y;
    const kind = kinds[out.length % 3];
    const r = { x: x - 22, y: y - 14, w: 44, h: 16 };
    if (world.blockedRect(r) || world.blockedByEntity(world.player, r)) continue;
    if (out.some((e) => Math.hypot(e.ent.x - x, e.ent.y - y) < 260)) continue;
    const ent = new Ent({ id: `enemy_${out.length}`, images: [], outfits: [], sounds: {}, collider: { ox: 0, oy: -6, w: 36, h: 14 } });
    ent.solid = false;
    ent.x = x; ent.y = y; ent.placed = true;
    const e: Enemy = { ent, kind, home: { x, y }, tx: x, ty: y, wait: Math.random() * 2, cooldown: 0, bone: null, boneT: 2 + Math.random() * 2, dead: 0, hop: Math.random() * 6 };
    ent.custom = (g, en, sx, sy) => draw(g, e, world, sx, sy, en);
    world.ents.set(ent.id, ent);
    out.push(e);
  }
  return out;
}

function draw(g: CanvasRenderingContext2D, e: Enemy, w: World, sx: number, sy: number, _en: Ent): void {
  const t = w.time;
  if (e.dead > 0) { g.globalAlpha = Math.max(0, 1 - e.dead * 2); }
  g.save();
  g.translate(sx, sy);
  if (e.kind === 'dado') {
    const f = (Math.floor(e.hop * 6) % 6) + 1;
    const im = img(`${C}DADOS/DadoA0${f}.png`, true);
    const bounce = Math.abs(Math.sin(e.hop * 4)) * 8;
    if (im) { g.drawImage(im, -26, -52 - bounce, 52, 52); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, -2, 20, 6, 0, 0, 7); g.fill();
  } else if (e.kind === 'calavera') {
    const im = img(`${C}calavera/Calavera0${1 + (Math.floor(t * 2) % 4)}.png`, true);
    if (im) g.drawImage(im, -42, -84, 84, 84);
    if (e.bone) { /* drawn in world space below */ }
  } else {
    const im = img(`pira/images/level1/PirataRonca/Pirata_Ronca_0${1 + (Math.floor(t * 1.2) % 2)}.png`, true);
    if (im) g.drawImage(im, -44, -84, 88, 88);
    const z = (t * 0.8) % 1;
    g.font = `800 ${14 + z * 6}px CPFutura, sans-serif`; g.fillStyle = `rgba(255,70,50,${1 - z})`; g.fillText('Z', 14 + z * 14, -72 - z * 24);
  }
  g.restore();
  g.globalAlpha = 1;
  if (e.bone) {
    const im = img(`${C}Mano/ManoGira0${1 + (Math.floor(t * 12) % 4)}.png`, true);
    const b = e.bone;
    if (im) g.drawImage(im, b.x - 18, b.y - 36, 36, 36);
  }
}

export function updateEnemies(world: World, list: Enemy[], dt: number, onContact: (e: Enemy) => void): void {
  const p = world.player;
  for (const e of list) {
    const en = e.ent;
    if (e.dead > 0) { e.dead += dt; continue; }
    if (e.cooldown > 0) e.cooldown -= dt;
    e.hop += dt * (e.kind === 'dado' ? 1.6 : 0.5);
    const dx = p.x - en.x, dy = p.y - en.y, dist = Math.hypot(dx, dy);
    let sp = SPEED[e.kind];
    if (e.kind === 'dado' && dist < 200 && e.cooldown <= 0) { e.tx = p.x; e.ty = p.y; sp = 96; e.wait = 0; }
    if (e.kind === 'ronca' && dist < 120 && e.cooldown <= 0) { e.tx = p.x; e.ty = p.y; sp = 40; e.wait = 0; }
    if (e.kind === 'calavera') {
      e.boneT -= dt;
      if (e.bone) {
        const b = e.bone;
        b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
        if (Math.hypot(b.x - p.x, b.y - (p.y - 30)) < 26 && e.cooldown <= 0) { e.bone = null; e.cooldown = 5; onContact(e); }
        else if (b.t > 2.2 || world.blockedAt(b.x, b.y + 30)) e.bone = null;
      } else if (e.boneT <= 0 && dist < 380 && e.cooldown <= 0) {
        e.boneT = 3 + Math.random() * 2;
        const l = Math.max(1, dist);
        e.bone = { x: en.x, y: en.y - 40, vx: (dx / l) * 220, vy: ((dy - 30) / l) * 220, t: 0 };
        playSound('pira/audio/fx/NIVEL_5/Calavera_Tira_hueso.ogg', 0.5);
      }
    } else if (sp > 0) {
      const tdx = e.tx - en.x, tdy = e.ty - en.y, td = Math.hypot(tdx, tdy);
      if (td < 6 || e.wait > 0) {
        e.wait -= dt;
        if (e.wait <= 0 && td < 6) { e.tx = e.home.x + (Math.random() * 2 - 1) * 140; e.ty = e.home.y + (Math.random() * 2 - 1) * 90; e.wait = 1 + Math.random() * 2; }
      } else {
        const s = sp * dt;
        const moved = world.tryMove(en, (tdx / td) * s, 0, true) || world.tryMove(en, 0, (tdy / td) * s, true);
        if (!moved) { e.tx = e.home.x; e.ty = e.home.y; e.wait = 0.5; }
      }
    }
    if (dist < 34 && e.cooldown <= 0 && e.kind !== 'calavera') { e.cooldown = 5; onContact(e); }
  }
}

export function defeat(e: Enemy): void { e.dead = 0.001; e.ent.active = true; }
export function aliveEnemies(list: Enemy[]): Enemy[] { return list.filter((e) => e.dead < 0.5); }
