// Pause menu (Esc): resume / console / save & quit to title.
import { App, W, H, type Scene } from '../core/app';
import { isPressed } from '../core/input';
import { button, panel, text } from '../ui/text';
import { commit } from '../save';
import { toTitle } from './flow';
import { isMusicOn, isSoundOn, setMusicEnabled, setSoundEnabled } from '../core/audio';

export class PauseScene implements Scene {
  overlay = true;
  update(_dt: number, app: App): void {
    if (isPressed('back')) app.pop();
  }
  render(g: CanvasRenderingContext2D, app: App): void {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, W, H);
    panel(g, W / 2 - 300, 190, 600, 520);
    text(g, 'Pausa', W / 2, 270, { size: 60, align: 'center', weight: 800, color: '#7a2a12' });
    if (button(g, { x: W / 2 - 220, y: 310, w: 440, h: 70, label: 'Seguir jugando' })) app.pop();
    if (button(g, { x: W / 2 - 220, y: 400, w: 440, h: 70, label: isMusicOn() ? 'Música: sí' : 'Música: no' })) setMusicEnabled(!isMusicOn());
    if (button(g, { x: W / 2 - 220, y: 490, w: 440, h: 70, label: isSoundOn() ? 'Efectos: sí' : 'Efectos: no' })) setSoundEnabled(!isSoundOn());
    if (button(g, { x: W / 2 - 220, y: 580, w: 440, h: 70, label: 'Guardar y salir al título' })) { commit(); app.pop(); void toTitle(app); }
  }
}
