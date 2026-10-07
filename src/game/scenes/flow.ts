// Game flow: what happens after a hero is chosen / a save is resumed. Scenes are imported lazily to avoid import cycles.
import type { App } from '../core/app';
import type { Hero } from '../save';

export async function startHero(app: App, hero: Hero, isNew: boolean): Promise<void> {
  const { HubScene } = await import('./hub');
  app.goto(new HubScene(hero, isNew));
}

export async function toTitle(app: App): Promise<void> {
  const { TitleScene } = await import('./title');
  app.goto(new TitleScene());
}
