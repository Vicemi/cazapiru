// Level registry (lazy imports keep the first load small).
import type { PiraLevel, PiraResult } from './base';

export async function makeLevel(n: number, done: (r: PiraResult) => void): Promise<PiraLevel> {
  switch (n) {
    case 1: return new (await import('./level1')).Level1(done);
    case 2: return new (await import('./level2')).Level2(done);
    case 3: return new (await import('./level3')).Level3(done);
    case 4: return new (await import('./level4')).Level4(done);
    case 5: return new (await import('./level5')).Level5(done);
    default: return new (await import('./level6')).Level6(done);
  }
}
