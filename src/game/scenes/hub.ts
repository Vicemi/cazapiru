// Entry after the menu: a new game plays the opening, a resumed one goes straight back to where the player was.
import { App, type Scene } from '../core/app';
import type { Hero } from '../save';
import { save } from '../save';

export class HubScene implements Scene {
  constructor(private hero: Hero, private isNew: boolean) {}
  enter(app: App): void {
    if (this.isNew) { void import('./story').then(({ IntroScene }) => app.goto(new IntroScene(this.hero))); return; }
    const f = save().flags as unknown as Record<string, number | string | undefined>;
    const map = typeof f.lastMap === 'string' ? f.lastMap : 'academy';
    const at = typeof f.lastX === 'number' && typeof f.lastY === 'number' ? { x: f.lastX, y: f.lastY } : undefined;
    void import('./caza').then(({ CazaScene }) => app.goto(new CazaScene(map, typeof f.lastSpawn === 'string' ? f.lastSpawn : undefined, at)));
  }
  update(): void { /* async handoff */ }
  render(g: CanvasRenderingContext2D): void { g.fillStyle = '#000'; g.fillRect(0, 0, 1200, 900); }
}
