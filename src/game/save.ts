// Persistent progress (localStorage). One slot. Shared by both halves of the game: crystals and score are the common currency.

export type Hero = 'aki' | 'pi';

export interface Save {
  v: 1;
  hero: Hero | null;
  /** Cazaproblemas story tier (the original currentTier variable of the Lua scripts) */
  tier: number;
  crystals: number;
  score: number;
  items: string[];
  outfit: string;
  solved: number[];
  /** puzzle ids answered wrong at least once (they come back later) */
  failed: number[];
  /** Piracalculos: highest level unlocked (1..6), best stars per level, lives kept between levels */
  pira: { unlocked: number; stars: number[]; won: boolean };
  /** crossover chapter reached (see story/chapters.ts) */
  chapter: number;
  flags: Record<string, number>;
  played: number;
}

const KEY = 'cazapira.save.v1';

export function fresh(): Save {
  return {
    v: 1, hero: null, tier: 1020, crystals: 0, score: 0, items: [], outfit: 'default', solved: [], failed: [],
    pira: { unlocked: 1, stars: [0, 0, 0, 0, 0, 0], won: false }, chapter: 0, flags: {}, played: 0,
  };
}

let cur: Save = load() ?? fresh();

function load(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    return s && s.v === 1 ? { ...fresh(), ...s, pira: { ...fresh().pira, ...s.pira } } : null;
  } catch {
    return null;
  }
}

export function save(): Save { return cur; }
/** Normal difficulty = the 5th-year problems with extra help; Difícil = the 6th-year bank (flags.year keeps the original Lua meaning). */
export function isEasy(): boolean { return (cur.flags.year ?? 5) < 6; }
export function hasSave(): boolean { try { return !!localStorage.getItem(KEY); } catch { return false; } }
export function commit(): void { try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* private mode */ } }
export function newGame(hero: Hero): Save { cur = fresh(); cur.hero = hero; commit(); return cur; }
export function resume(): Save { cur = load() ?? fresh(); return cur; }
export function wipe(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } cur = fresh(); }
