// Input: keyboard (arrows/WASD move, Space/Enter/E/X act, Esc/Backspace/Q back, C console, M map) and pointer (mouse / touch)
// in logical canvas coordinates. Everything is sampled once per update with pressed-this-frame semantics.

export type Btn = 'up' | 'down' | 'left' | 'right' | 'act' | 'back' | 'console' | 'map' | 'alt';

const BINDINGS: Record<Btn, string[]> = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  act: ['Space', 'Enter', 'NumpadEnter', 'KeyE', 'KeyX'], back: ['Escape', 'Backspace', 'KeyQ'], console: ['KeyC', 'Tab'], map: ['KeyM', 'KeyZ'],
  alt: ['ShiftLeft', 'ShiftRight'],
};

const down = new Set<string>();
const tapped = new Set<string>();
let prev = new Set<string>();
let curr = new Set<string>();
let typed: string[] = [];

/** `pressed`: edge seen by the next update tick. `clicked`: latched until the frame has been drawn (immediate-mode buttons read it while rendering). */
export const pointer = { x: 0, y: 0, down: false, pressed: false, clicked: false, released: false, inside: false };
let pDown = false, pPressed = false, pReleased = false;

let logicalW = 1200, logicalH = 900;
export function setLogicalSize(w: number, h: number): void { logicalW = w; logicalH = h; }

export function attachInput(canvas: HTMLCanvasElement): () => void {
  const kd = (e: KeyboardEvent) => {
    if (!down.has(e.code)) tapped.add(e.code);
    down.add(e.code);
    if (e.key.length === 1) typed.push(e.key);
    else if (e.key === 'Backspace') typed.push('\b');
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  };
  const ku = (e: KeyboardEvent) => down.delete(e.code);
  const clear = () => down.clear();
  const toLogical = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const s = Math.min(r.width / logicalW, r.height / logicalH);
    pointer.x = (e.clientX - r.left - (r.width - logicalW * s) / 2) / s;
    pointer.y = (e.clientY - r.top - (r.height - logicalH * s) / 2) / s;
  };
  const pd = (e: PointerEvent) => { toLogical(e); pDown = true; pPressed = true; pointer.clicked = true; pointer.inside = true; };
  const pm = (e: PointerEvent) => { toLogical(e); pointer.inside = true; };
  const pu = (e: PointerEvent) => { toLogical(e); pDown = false; pReleased = true; };
  const pl = () => { pointer.inside = false; };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  window.addEventListener('blur', clear);
  canvas.addEventListener('pointerdown', pd);
  canvas.addEventListener('pointermove', pm);
  window.addEventListener('pointerup', pu);
  canvas.addEventListener('pointerleave', pl);
  return () => {
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
    window.removeEventListener('blur', clear);
    canvas.removeEventListener('pointerdown', pd);
    canvas.removeEventListener('pointermove', pm);
    window.removeEventListener('pointerup', pu);
    canvas.removeEventListener('pointerleave', pl);
  };
}

/** Once per fixed update, before the game logic reads input. */
export function pollInput(): void {
  prev = curr;
  curr = new Set(down);
  for (const k of tapped) { curr.add(k); prev.delete(k); }
  tapped.clear();
  pointer.down = pDown; pointer.pressed = pPressed; pointer.released = pReleased;
  pPressed = false; pReleased = false;
}

/** Called by the app after every drawn frame. */
export function endFrame(): void { pointer.clicked = false; }

export function isDown(b: Btn): boolean { return BINDINGS[b].some((c) => curr.has(c)); }
export function isPressed(b: Btn): boolean { return BINDINGS[b].some((c) => curr.has(c) && !prev.has(c)); }
export function keyDown(code: string): boolean { return curr.has(code); }
export function keyPressed(code: string): boolean { return curr.has(code) && !prev.has(code); }
export function anyKeyPressed(): boolean { for (const k of curr) if (!prev.has(k)) return true; return false; }
/** Characters typed since the last call (for text answers). '\b' is backspace. */
export function takeTyped(): string[] { const t = typed; typed = []; return t; }
export function resetInput(): void { down.clear(); tapped.clear(); prev = new Set(); curr = new Set(); typed = []; }
