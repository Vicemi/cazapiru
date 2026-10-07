// Application shell: fixed 60 Hz update + rAF render on a 1200x900 logical canvas (the OLPC XO screen both source games were made for),
// a scene stack with fade transitions, and tiny helpers shared by every scene.
import { attachInput, endFrame, pollInput, resetInput, setLogicalSize } from './input';
import { unlockAudio } from './audio';

export const W = 1200;
export const H = 900;

export interface Scene {
  /** Called once when the scene becomes the active one. */
  enter?(app: App, arg?: unknown): void | Promise<void>;
  leave?(app: App): void;
  update(dt: number, app: App): void;
  render(g: CanvasRenderingContext2D, app: App): void;
  /** Return true to let the scene underneath update too (overlays). */
  overlay?: boolean;
}

export class App {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  private stack: Scene[] = [];
  private raf = 0;
  private last = 0;
  private acc = 0;
  private detach: (() => void) | null = null;
  private fade: { t: number; dur: number; from: number; to: number; then?: () => void } | null = null;
  fadeAlpha = 0;
  time = 0;
  /** free-form shared state between scenes (set by the game bootstrap) */
  state: Record<string, unknown> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.g = canvas.getContext('2d')!;
    setLogicalSize(W, H);
  }

  get scene(): Scene | undefined { return this.stack[this.stack.length - 1]; }
  get depth(): number { return this.stack.length; }

  start(first: Scene, arg?: unknown): void {
    this.detach = attachInput(this.canvas);
    void this.push(first, arg);
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt;
      let n = 0;
      while (this.acc >= 1 / 60 && n++ < 6) { this.acc -= 1 / 60; this.tick(1 / 60); }
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.detach?.();
  }

  /** Advance the simulation manually (tests / hidden tab). */
  step(n = 1): void { for (let i = 0; i < n; i++) this.tick(1 / 60); this.draw(); }

  private tick(dt: number): void {
    pollInput();
    this.time += dt;
    if (this.fade) {
      this.fade.t += dt;
      const k = Math.min(1, this.fade.t / this.fade.dur);
      this.fadeAlpha = this.fade.from + (this.fade.to - this.fade.from) * k;
      if (k >= 1) { const f = this.fade; this.fade = null; f.then?.(); }
    }
    // overlays: update from the first non-overlay scene on the stack up to the top
    let i = this.stack.length - 1;
    while (i > 0 && this.stack[i].overlay) i--;
    for (; i < this.stack.length; i++) this.stack[i].update(dt, this);
  }

  private draw(): void {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    let i = this.stack.length - 1;
    while (i > 0 && this.stack[i].overlay) i--;
    for (; i < this.stack.length; i++) { g.save(); this.stack[i].render(g, this); g.restore(); }
    if (this.fadeAlpha > 0) { g.fillStyle = `rgba(0,0,0,${this.fadeAlpha})`; g.fillRect(0, 0, W, H); }
    endFrame();
  }

  async push(s: Scene, arg?: unknown): Promise<void> {
    this.stack.push(s);
    await s.enter?.(this, arg);
  }
  pop(): void {
    const s = this.stack.pop();
    s?.leave?.(this);
  }
  /** Replace the whole stack with `s` (fade out, swap, fade in). */
  goto(s: Scene, arg?: unknown, dur = 0.35): void {
    const swap = async () => {
      while (this.stack.length) this.pop();
      resetInput();
      await this.push(s, arg);
      this.fade = { t: 0, dur, from: 1, to: 0 };
    };
    if (this.stack.length === 0) { void swap(); return; }
    this.fade = { t: 0, dur, from: this.fadeAlpha, to: 1, then: () => void swap() };
  }

  userGesture(): void { unlockAudio(); }
}

// ------------------------------------------------------------------ drawing helpers
export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Word-wrap `text` into lines no wider than `maxW` with the current font. */
export function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? line + ' ' + word : word;
      if (line && g.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
