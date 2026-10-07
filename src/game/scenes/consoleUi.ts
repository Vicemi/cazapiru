// The console (key C): journal, world map, items / outfits and the Ecos of the pirate sea. Drawn on the original console picture.
import { App, W, H, type Scene, wrap } from '../core/app';
import { img, json } from '../core/assets';
import { playSound } from '../core/audio';
import { isPressed, keyPressed, pointer } from '../core/input';
import { text, setFont } from '../ui/text';
import { commit, save } from '../save';
import { PORTALS, closedEcos, portalDone, portalOpen } from '../story/fusion';
import { OUTFITS, currentOutfit, drawHeroHead, outfitOwned, skinned } from '../story/skins';
import type { CazaScene } from './caza';
import type { XNode } from '../caza/data';

const MONO = 'CPMono, "Courier New", monospace';
type Tab = 'journal' | 'map' | 'items' | 'ecos';
const TABS: { id: Tab; label: string }[] = [{ id: 'journal', label: 'Diario' }, { id: 'map', label: 'Mapa' }, { id: 'items', label: 'Objetos' }, { id: 'ecos', label: 'Ecos' }];

interface Entry { tier: number; text: string }
let journal: Entry[] | null = null;
let areas: { map: string; x: number; y: number; w: number; h: number }[] | null = null;

/** Entries written for the fusion (shown after the original ones, by condition). */
function fusionEntries(): Entry[] {
  const s = save();
  const out: Entry[] = [];
  const f = s.flags;
  const pi = s.hero === 'pi';
  if (f.met) out.push({ tier: 0, text: pi
    ? 'La noche del eclipse crucé un portal y caí sobre la Fuente de la Academia. Allí conocí a Aki, el hijo de Gladius: somos casi hermanos. Yo estudio en la Academia; Aki es aprendiz de campo.'
    : 'La noche del eclipse, Pi y su loro Flo cayeron de un portal sobre la Fuente. Gladius lo crió en el mar: somos casi hermanos. Yo estudio en la Academia; Pi es aprendiz de campo.' });
  const other = pi ? 'Aki' : 'Pi';
  if (f.enc_towers) out.push({ tier: 0, text: `${other} escuchó a dos profesores decir que Gladius "nunca se equivocó".` });
  if (f.enc_diploma) out.push({ tier: 0, text: `${other} también se graduó como Cazaproblemas, como aprendiz de campo.` });
  if (f.enc_order) out.push({ tier: 0, text: 'Gladius y Quimerius formaban parte de una Orden secreta.' });
  if (f.enc_fountain) out.push({ tier: 0, text: 'El plano de Armandius prueba que la catapulta apuntó bien: Gladius escondió la luna a propósito. Está bajo la Fuente.' });
  if (f.rift) out.push({ tier: 0, text: 'Desde la noche del eclipse aparecen criaturas del Mar de los Números en Terragrifus: dados que ruedan, calaveras sobre cofres y piratas roncos. Si me alcanzan, me desafían a un duelo de cálculo.' });
  PORTALS.forEach((p) => {
    if (portalDone(s, p)) out.push({ tier: 0, text: `Cerré el ${p.name}. Cada Eco cerrado devuelve un pedazo del mar a su lugar (${closedEcos(s)}/5).` });
  });
  if (f.finale) out.push({ tier: 0, text: 'Bajo la Fuente superamos el Duelo del Sabio, vencimos a Olivera y encontramos a Gladius. La luna azul vuelve a su sitio.' });
  return out;
}

export class ConsoleScene implements Scene {
  private tab: Tab = 'journal';
  private page = 0;
  private ready = false;
  private markers: { x: number; y: number; color: string }[] = [];

  constructor(private cz: CazaScene) {}

  async enter(): Promise<void> {
    if (!journal) {
      const root = await json<XNode>('caza/journal/journal.xml.json');
      journal = [];
      for (const pg of root.c ?? []) for (const e of pg.c ?? []) journal.push({ tier: +(e.a?.tier ?? 0), text: (e.x ?? '').trim() });
      journal.sort((a, b) => a.tier - b.tier);
    }
    if (!areas) {
      const root = await json<XNode>('caza/maps/areas.xml.json');
      areas = (root.c ?? []).map((a) => ({ map: a.a!.map, x: +a.a!.x, y: +a.a!.y, w: +a.a!.width, h: +a.a!.height }));
    }
    this.markers = this.computeMarkers();
    this.ready = true;
    playSound('caza/sounds/console/items_open.ogg', 0.6);
  }

  leave(): void { playSound('caza/sounds/console/items_close.ogg', 0.6); }

  private computeMarkers(): { x: number; y: number; color: string }[] {
    const out: { x: number; y: number; color: string }[] = [];
    try {
      const g = this.cz.host.g;
      const f = save().flags as unknown as { town?: { active: string[]; assigned: Record<string, number> } };
      const loc = g.get('locations') as { get(k: number): unknown; length(): number };
      const pc = g.get('puzzles_color') as { get(k: number): { get(k: string): unknown } | null };
      for (const name of f.town?.active ?? []) {
        for (let i = 1; i <= loc.length(); i++) {
          const row = loc.get(i) as { get(k: number): unknown };
          if (row.get(1) === name) {
            const pid = f.town!.assigned[name];
            const c = pc.get(pid)?.get('color') as string | undefined;
            out.push({ x: Number(row.get(2)), y: Number(row.get(3)), color: c ?? 'yellow' });
          }
        }
      }
    } catch { /* no town data yet */ }
    return out;
  }

  update(_dt: number, app: App): void {
    if (isPressed('back') || isPressed('console')) { app.pop(); return; }
    if (keyPressed('Digit1')) this.tab = 'journal';
    if (keyPressed('Digit2')) this.tab = 'map';
    if (keyPressed('Digit3')) this.tab = 'items';
    if (keyPressed('Digit4')) this.tab = 'ecos';
    if (isPressed('left')) this.page = Math.max(0, this.page - 1);
    if (isPressed('right')) this.page++;
  }

  private hover(x: number, y: number, w: number, h: number): boolean { return pointer.inside && pointer.x >= x && pointer.x < x + w && pointer.y >= y && pointer.y < y + h; }

  render(g: CanvasRenderingContext2D): void {
    const bg = img('caza/screens/inventory/img_background.png');
    g.fillStyle = '#12030c'; g.fillRect(0, 0, W, H);
    if (bg) g.drawImage(bg, 0, 0, W, H);
    const bar = img('caza/screens/inventory/img_controls.png');
    if (bar) g.drawImage(bar, 0, H - 230, W, 230);
    if (!this.ready) return;
    TABS.forEach((t, i) => {
      const x = 60 + i * 200, y = 40, w = 180, h = 54;
      const on = this.tab === t.id, over = this.hover(x, y, w, h);
      g.fillStyle = on ? 'rgba(90,200,255,0.25)' : over ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)';
      g.fillRect(x, y, w, h);
      g.strokeStyle = on ? '#6fd0ff' : '#4a6a80'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
      g.font = `700 28px ${MONO}`; g.fillStyle = on ? '#fff' : '#9ab'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${i + 1} ${t.label}`, x + w / 2, y + h / 2);
      if (over && pointer.clicked) { this.tab = t.id; this.page = 0; playSound('caza/sounds/console/btn_press.ogg', 0.5); }
    });
    text(g, `Cristales ${save().crystals}   ·   ${save().score} pts`, W - 50, 68, { size: 28, align: 'right', color: '#9fe8ff' });
    switch (this.tab) {
      case 'journal': this.drawJournal(g); break;
      case 'map': this.drawMap(g); break;
      case 'items': this.drawItems(g); break;
      case 'ecos': this.drawEcos(g); break;
    }
    text(g, 'C / Esc: cerrar    ← →: página    1-4: pestañas', W / 2, H - 244, { size: 22, align: 'center', color: '#7a98ac' });
  }

  private drawJournal(g: CanvasRenderingContext2D): void {
    const tier = save().tier;
    const all = [...(journal ?? []).filter((e) => e.tier <= tier), ...fusionEntries()];
    const per = 2;
    const pages = Math.max(1, Math.ceil(all.length / per));
    this.page = Math.min(this.page, pages - 1);
    const items = all.slice(this.page * per, this.page * per + per);
    setFont(g, 28, 400);
    g.font = `400 28px ${MONO}`;
    let y = 150;
    for (const e of items) {
      const lines = wrap(g, e.text, 1040);
      g.fillStyle = '#6fd0ff'; g.fillText('▸', 56, y);
      for (const l of lines.slice(0, 7)) { g.fillStyle = '#e8f6ff'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(l, 90, y); y += 36; }
      y += 30;
    }
    if (!items.length) text(g, 'Todavía no escribiste nada en tu diario.', 90, 170, { size: 28, color: '#9ab' });
    text(g, `Página ${this.page + 1}/${pages}`, W / 2, H - 270, { size: 24, align: 'center', color: '#9ab' });
    for (const [x, d, label] of [[430, -1, '◀'], [770, 1, '▶']] as [number, number, string][]) {
      if (this.hover(x, H - 300, 80, 50)) { text(g, label, x + 40, H - 276, { size: 36, align: 'center', color: '#fff' }); if (pointer.clicked) this.page = Math.max(0, Math.min(pages - 1, this.page + d)); }
      else text(g, label, x + 40, H - 276, { size: 36, align: 'center', color: '#789' });
    }
  }

  private drawMap(g: CanvasRenderingContext2D): void {
    const map = img('caza/screens/inventory/map/img_map_academy.png');
    const mx = 68, my = 130, sc = 2;
    if (map) g.drawImage(map, mx, my, 532 * sc, 275 * sc);
    const w = this.cz.world;
    const a = areas?.find((q) => q.map === this.cz.mapId);
    if (a) {
      // the head of the hero you play (with the current outfit / skin), on a pin
      const j = w.map.json;
      const px = mx + (a.x + (w.player.x / (j.w * j.tw)) * a.w) * sc, py = my + (a.y + (w.player.y / (j.h * j.th)) * a.h) * sc;
      const bob = Math.sin(performance.now() / 200) * 3;
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.moveTo(px - 10, py - 24 + bob); g.lineTo(px + 10, py - 24 + bob); g.lineTo(px, py); g.closePath(); g.fill();
      drawHeroHead(g, px, py - 52 + bob, 34);
    }
    for (const m of this.markers) {
      const im = img(`caza/screens/inventory/map/img_map_cursor_${m.color}.png`);
      if (im) g.drawImage(im, mx + m.x * sc - 16, my + m.y * sc - 56, 32, 64);
    }
    text(g, 'Tu posición y los problemas pendientes (por color)', W / 2, 700, { size: 26, align: 'center', color: '#9ab' });
  }

  private drawItems(g: CanvasRenderingContext2D): void {
    const s = save();
    text(g, 'Atuendos', 60, 150, { size: 34, color: '#ffe066', weight: 700 });
    // the same four outfits for both heroes: bought in the story, shared by Aki and Pi
    const pi = s.hero === 'pi';
    const cur = currentOutfit();
    OUTFITS.forEach((o, i) => {
      const have = outfitOwned(o.id);
      const x = 60 + i * 270, y = 180, w = 250, h = 250;
      const sel = cur === o.id, over = this.hover(x, y, w, h) && have;
      g.fillStyle = sel ? 'rgba(90,200,255,0.25)' : 'rgba(0,0,0,0.3)'; g.fillRect(x, y, w, h);
      g.strokeStyle = sel ? '#6fd0ff' : over ? '#fff' : '#4a6a80'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
      g.globalAlpha = have ? 1 : 0.3;
      if (pi) { const im = skinned('pira/images/characters/Pi/Pi_00.png', o); if (im) g.drawImage(im, x + w / 2 - 100, y + 14, 200, 200); }
      else { const im = img(`caza/objects/pc/images/pc_${o.id}_default_s001.png`); if (im) g.drawImage(im, x + w / 2 - 70, y + 20, 140, 200); }
      g.globalAlpha = 1;
      if (!have) text(g, '?', x + w / 2, y + 140, { size: 90, align: 'center', weight: 800, color: 'rgba(255,255,255,0.75)', outline: '#000', outlineW: 8 });
      text(g, have ? (pi ? o.piLabel : o.label) : '???', x + w / 2, y + h - 12, { size: 26, align: 'center', color: have ? '#fff' : '#678' });
      if (over && pointer.clicked) {
        s.outfit = o.id; this.cz.world.player.outfit = o.id; commit(); playSound('caza/sounds/console/btn_press.ogg', 0.5);
      }
    });
    text(g, 'Los atuendos se consiguen en la historia y sirven para los dos héroes.', 60, 470, { size: 22, color: '#9ab' });
    text(g, 'Objetos', 60, 520, { size: 34, color: '#ffe066', weight: 700 });
    const keyItems: [string, string, string?][] = [['item_blueprint', 'Plano de la catapulta', 'caza/screens/inventory/items/img_blueprint.png'], ['item_miniature', 'Miniatura del Fracaso de Gladius', 'caza/screens/inventory/items/img_catapult.png'], ['finished_all_puzzles', 'Insignia de Cazaproblemas']];
    let y = 570;
    for (const [id, label, pic] of keyItems) {
      if (!s.items.includes(id)) continue;
      const im = pic ? img(pic) : null;
      if (im) g.drawImage(im, 60, y - 24, 100, 44);
      text(g, label, 190, y + 4, { size: 26, color: '#e8f6ff' });
      y += 56;
    }
    if (y === 570) text(g, 'Todavía no tenés objetos especiales.', 60, 590, { size: 24, color: '#9ab' });
  }

  private drawEcos(g: CanvasRenderingContext2D): void {
    const s = save();
    text(g, `Ecos del Mar de los Números cerrados: ${closedEcos(s)}/5`, 60, 160, { size: 34, color: '#ffe066', weight: 700 });
    PORTALS.forEach((p, i) => {
      const y = 200 + i * 86;
      const done = portalDone(s, p), open = portalOpen(s, p);
      g.fillStyle = done ? 'rgba(60,200,120,0.18)' : open ? 'rgba(90,200,255,0.15)' : 'rgba(0,0,0,0.3)';
      g.fillRect(60, y, 1070, 72);
      g.strokeStyle = done ? '#58e08a' : open ? '#6fd0ff' : '#4a6a80'; g.lineWidth = 3; g.strokeRect(60, y, 1070, 72);
      text(g, `${done ? '✔' : open ? '◎' : '🔒'}  ${p.name}`, 84, y + 44, { size: 30, color: done ? '#9fffb8' : open ? '#e8f6ff' : '#789' });
      const where = { logiverum: 'Logiverum', woods: 'el Bosque', mountains: 'las Montañas' }[p.map] ?? p.map;
      text(g, `${where} · ${'★'.repeat(s.pira.stars[p.level - 1])}${'☆'.repeat(3 - s.pira.stars[p.level - 1])}`, 1110, y + 44, { size: 26, align: 'right', color: '#ffe066' });
    });
    text(g, 'Al cerrar los cinco Ecos, el Vis deja de escaparse al mar.', W / 2, 650, { size: 24, align: 'center', color: '#9ab' });
  }
}
