import { useEffect, useRef, useState } from 'react';

/**
 * Mobile controls (everything becomes keyboard events, so the game's own input code is reused unchanged):
 * - bottom-left zone: floating joystick (arrow keys, 8 directions)
 * - bottom-right: big action button (Space), console (C) and menu (Esc); the pirate levels that are mouse-only hide them.
 * Taps anywhere else reach the canvas directly (menus, dialogs, puzzles, click-to-walk).
 */
type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Space' | 'KeyC' | 'Escape';
const STICK_RADIUS = 58;
const DEAD_ZONE = 14;

const held = new Map<Key, number>();
function keyDown(code: Key): void {
  const n = held.get(code) ?? 0;
  held.set(code, n + 1);
  if (n === 0) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}
function keyUp(code: Key): void {
  const n = held.get(code) ?? 0;
  if (n <= 1) {
    held.delete(code);
    if (n === 1) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  } else held.set(code, n - 1);
}
function releaseAll(): void {
  for (const code of [...held.keys()]) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  held.clear();
}
const buzz = (ms: number) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

function stickKeys(dx: number, dy: number): Key[] {
  const d = Math.hypot(dx, dy);
  if (d < DEAD_ZONE) return [];
  const out: Key[] = [];
  if (Math.abs(dx) / d > 0.38) out.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
  if (Math.abs(dy) / d > 0.38) out.push(dy > 0 ? 'ArrowDown' : 'ArrowUp');
  return out;
}

interface Stick { id: number; ox: number; oy: number; keys: Key[] }

export default function TouchControls({ mode }: { mode: 'none' | 'keys' | 'full' }) {
  const stick = useRef<Stick | null>(null);
  const [view, setView] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const [down, setDown] = useState<Set<Key>>(new Set());

  useEffect(() => {
    if (mode === 'none') { stick.current = null; setView(null); setDown(new Set()); releaseAll(); }
  }, [mode]);
  useEffect(() => {
    const blur = () => { stick.current = null; setView(null); setDown(new Set()); releaseAll(); };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', blur);
    return () => { window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', blur); };
  }, []);

  const setKeys = (s: Stick, keys: Key[]) => {
    for (const k of s.keys) if (!keys.includes(k)) keyUp(k);
    for (const k of keys) if (!s.keys.includes(k)) keyDown(k);
    s.keys = keys;
  };

  const zoneDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ }
    if (stick.current) return;
    stick.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY, keys: [] };
    setView({ ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY });
  };
  const zoneMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stick.current;
    if (!s || s.id !== e.pointerId) return;
    let { ox, oy } = s;
    const x = e.clientX, y = e.clientY;
    const dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy);
    if (d > STICK_RADIUS) { ox = x - (dx / d) * STICK_RADIUS; oy = y - (dy / d) * STICK_RADIUS; }
    s.ox = ox; s.oy = oy;
    setKeys(s, stickKeys(x - ox, y - oy));
    setView({ ox, oy, x, y });
  };
  const zoneUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stick.current;
    if (s && s.id === e.pointerId) { setKeys(s, []); stick.current = null; setView(null); }
  };

  const press = (k: Key) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault(); e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ }
    keyDown(k); buzz(8); setDown((d) => new Set(d).add(k));
  };
  const release = (k: Key) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault(); e.stopPropagation();
    keyUp(k); setDown((d) => { const n = new Set(d); n.delete(k); return n; });
  };

  if (mode === 'none') return null;
  const knob = view ? (() => {
    const dx = view.x - view.ox, dy = view.y - view.oy, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, STICK_RADIUS / d);
    return { x: view.ox + dx * k, y: view.oy + dy * k };
  })() : null;
  const btn = (k: Key, label: string, cls: string) => (
    <button key={k} className={`cp-act ${cls}${down.has(k) ? ' is-down' : ''}`} onPointerDown={press(k)} onPointerUp={release(k)} onPointerCancel={release(k)}
      onContextMenu={(e) => e.preventDefault()} aria-label={label}>{label}</button>
  );

  return (
    <div className="cp-touch">
      <div className="cp-stick-zone" onPointerDown={zoneDown} onPointerMove={zoneMove} onPointerUp={zoneUp} onPointerCancel={zoneUp} onContextMenu={(e) => e.preventDefault()}>
        {!view && <div className="cp-stick-hint" aria-hidden="true">✥</div>}
      </div>
      {view && knob && (
        <>
          <div className="cp-stick-ring" style={{ left: view.ox, top: view.oy }} />
          <div className="cp-stick-knob" style={{ left: knob.x, top: knob.y }} />
        </>
      )}
      {btn('Space', 'A', 'cp-a')}
      {mode === 'full' && btn('KeyC', 'C', 'cp-c')}
      {mode === 'full' && btn('Escape', '☰', 'cp-esc')}
    </div>
  );
}
