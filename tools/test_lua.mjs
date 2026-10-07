// Smoke test of src/game/caza/lua51.ts against real Cazaproblemas scripts (bundled on the fly with esbuild).
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const out = 'research/lua51.bundle.mjs';
await build({ entryPoints: ['src/game/caza/lua51.ts'], bundle: true, format: 'esm', outfile: out, platform: 'node', logLevel: 'error' });
const L = await import(pathToFileURL(process.cwd() + '/' + out).href);
const D = 'F:/Games/Cazaproblemas/data/';

const g = new L.LuaTable();
L.stdlib(g);
L.setGlobals(g);
const log = [];
const dialog = new L.LuaTable();
dialog.set('line', (...a) => { log.push('LINE ' + a.map(L.tostr).join('|')); });
dialog.set('start', (id, cb) => { log.push('DIALOG ' + id); });
g.set('Dialog', dialog);
const trigger = new L.LuaTable();
g.set('Trigger', trigger);
g.set('change_map', (m, w) => { log.push('MAP ' + m + ' ' + w); });
g.set('currentTier', 1020);

// 1) dialog script
L.closureOf; const run = (file) => L.call(L.closureOf(L.load(readFileSync(D + file))));
run('dialogs/scripts/dialog_001.lua');
// 2) a trigger script defines Trigger.action / Trigger.enter
run('objects/npc001_luceria/triggers/npc001_luceria_trigger.lua');
L.call(trigger.get('enter'), null);
log.push('tier=' + L.tostr(g.get('currentTier')));
L.call(trigger.get('action'), null);
// 3) tiers table
run('tiers.lua');
log.push('tiers len=' + g.get('tiers').length());
console.log(log.join('\n'));
