// Hero handling for the two protagonists: names in dialogs and the player sprite of the Cazaproblemas world.
// Aki uses the original walking frames; Pi (the pirate of Piracálculos) is drawn from his own sprites at half size, with Flo following.
import { img } from '../core/assets';
import { save } from '../save';
import { skinned } from './skins';
import { Ent, type World } from '../caza/world';

/** Dialog text for the active hero: [Aki] -> [Pi], Aki -> Pi. */
export function heroName(s: string): string {
  if (save().hero !== 'pi') return s;
  return s
    .replace(/\bAki\b(?!​)/g, 'Pi');   // a zero-width space after the name keeps Aki as Aki (story lines where both appear)
  // Pi is a boy too (Gladius' foster son), so the original masculine lines stay as they are
}

export const PI = 'pira/images/characters/Pi/';
const FLO = 'pira/images/characters/Flo/';

export function heroSprite(w: World, p: Ent): void {
  if (save().hero !== 'pi') return;
  let face = 1;
  p.custom = (g, e, sx, sy) => {
    if (e.dir === 'e') face = 1; else if (e.dir === 'w') face = -1;
    drawPiSprite(g, e, sx, sy, w.time, face);
  };
  p.def.outfits.length = 0;
  // Flo: the parrot follows with a lag and flutters
  const flo = new Ent({ id: 'flo', images: [], outfits: [], sounds: {} });
  flo.x = p.x - 30; flo.y = p.y - 6; flo.placed = true;
  let fx = flo.x, fy = flo.y, bob = 0;
  flo.custom = (g, e, sx, sy) => {
    const im = img(`${FLO}Loro_0${1 + (Math.floor(bob * 8) % 5)}.png`, true);
    if (!im) return;
    g.save();
    g.translate(sx, sy - 54 + Math.sin(bob * 5) * 5);
    g.scale((p.x < fx ? 1 : -1) * 0.42, 0.42);
    g.drawImage(im, -64, -100);
    g.restore();
    void e;
  };
  w.ents.set('flo', flo);
  w.hooks.push((dt) => {
    bob += dt;
    const tx = p.x - face * 34, ty = p.y - 4;
    const k = 1 - Math.pow(0.001, dt);
    fx += (tx - fx) * k; fy += (ty - fy) * k;
    flo.x = fx; flo.y = fy + 1;
  });
}

// ------------------------------------------------------------------ the hero you did not pick: an NPC that walks the world on its own
/** Pi drawn from his Piracálculos frames at half size (walk cycle while moving, slow breathing when idle). */
export function drawPiSprite(g: CanvasRenderingContext2D, e: Ent, sx: number, sy: number, time: number, face: number): void {
  const name = e.moving ? `${PI}Pi_Caminar_${String(Math.floor(e.animT * 11) % 8).padStart(2, '0')}.png` : `${PI}Pi_00.png`;
  const im = skinned(name);   // the chosen skin recolors hair / coat / hat / pants
  if (!im) return;
  const bob = e.moving ? Math.abs(Math.sin(e.animT * 11 * Math.PI / 4)) * -3 : Math.sin(time * 2) * -1.2;
  // every Pi frame (idle and walk) faces left: mirror when facing east
  const f = -face;
  g.save(); g.translate(sx, sy + bob); g.scale(f * 0.5, 0.5); g.drawImage(im, -128, -240); g.restore();
}

/**
 * Spawns the other hero as a non-solid NPC. Aki uses the original walking frames (def id 'pc'); Pi uses his own frames and
 * brings Flo along. Movement goes through Ent.move so the world animates the walk.
 */
export function makePartner(w: World, x: number, y: number): Ent {
  const partner = save().hero === 'pi' ? 'aki' : 'pi';
  const def = partner === 'aki'
    ? { id: 'pc', images: [], outfits: ['default', 'brad', 'shadow', 'cold'], sounds: {}, collider: { ox: 0, oy: -7, w: 52, h: 12 } }
    : { id: 'partner_pi', images: [], outfits: [], sounds: {} };
  const e = new Ent(def);
  e.solid = false; e.placed = true; e.x = x; e.y = y; e.dir = 'w';
  e.outfit = 'default';   // the hero you did not pick always keeps the original look
  if (partner === 'pi') {
    let face = -1;
    e.custom = (g, en, sx, sy) => {
      if (en.dir === 'e') face = 1; else if (en.dir === 'w') face = -1;
      drawPiSprite(g, en, sx, sy, w.time, face);
    };
    const flo = new Ent({ id: 'partner_flo', images: [], outfits: [], sounds: {} });
    flo.solid = false; flo.placed = true;
    let fx = x + 30, fy = y, bob = 0;
    flo.custom = (g, _e, sx, sy) => {
      if (!e.active) return;
      const im = img(`${FLO}Loro_0${1 + (Math.floor(bob * 8) % 5)}.png`, true);
      if (!im) return;
      g.save(); g.translate(sx, sy - 54 + Math.sin(bob * 5) * 5); g.scale((e.x < fx ? 1 : -1) * 0.42, 0.42); g.drawImage(im, -64, -100); g.restore();
    };
    w.ents.set('partner_flo', flo);
    w.hooks.push((dt) => {
      bob += dt;
      flo.active = e.active;
      const k = 1 - Math.pow(0.002, dt);
      fx += (e.x + (e.dir === 'e' ? -34 : 34) - fx) * k; fy += (e.y - 4 - fy) * k;
      flo.x = fx; flo.y = fy + 1;
    });
  }
  w.ents.set('partner', e);
  return e;
}

export const partnerOf = (): 'aki' | 'pi' => (save().hero === 'pi' ? 'aki' : 'pi');
