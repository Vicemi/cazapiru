import { useEffect, useRef, useState } from 'react';
import { createGame } from '../game/main';
import type { App } from '../game/core/app';
import TouchControls from './TouchControls';

/** Full-window 4:3 canvas (1200x900 logical). Touch devices get a rotate prompt and a fullscreen button. */
export default function CazaPiraGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<App | null>(null);
  const [portrait, setPortrait] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [full, setFull] = useState(false);
  const [touchMode, setTouchMode] = useState<'none' | 'keys' | 'full'>('none');
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  useEffect(() => {
    const app = createGame(canvasRef.current!);
    appRef.current = app;
    if (import.meta.env.DEV) (window as unknown as { __cp: App }).__cp = app;
    const gesture = () => app.userGesture();
    window.addEventListener('pointerdown', gesture);
    window.addEventListener('keydown', gesture);
    return () => {
      window.removeEventListener('pointerdown', gesture);
      window.removeEventListener('keydown', gesture);
      app.stop();
    };
  }, []);

  useEffect(() => {
    const forced = new URLSearchParams(location.search).get('touch');
    setIsTouch(forced !== null ? forced !== '0' : 'ontouchstart' in window || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);
    const update = () => setPortrait(window.innerHeight > window.innerWidth * 1.15);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTouchMode(((appRef.current?.state.touch as 'none' | 'keys' | 'full') ?? 'none')), 150);
    return () => window.clearInterval(id);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) { void document.exitFullscreen?.(); return; }
    void stageRef.current?.requestFullscreen?.();
    try { void (window.screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation?.lock?.('landscape'); } catch { /* unsupported */ }
  };
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    const onKey = (e: KeyboardEvent) => { if (e.code === 'F4' || e.code === 'KeyF' && e.shiftKey) { e.preventDefault(); toggleFull(); } };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('fullscreenchange', onChange); window.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <div className="cp-stage" ref={stageRef}>
      <canvas ref={canvasRef} className="cp-canvas" tabIndex={0} />
      {isTouch && portrait && (
        <div className="cp-rotate"><div className="cp-rotate-inner"><span className="cp-rotate-icon">🔄</span><span>Girá el celular para jugar</span></div></div>
      )}
      {isTouch && !portrait && <TouchControls mode={touchMode} />}
      {canFull && (isTouch || full) && (
        <button className="cp-top-btn" aria-label="Pantalla completa" onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleFull(); }}>{full ? '✕' : '⛶'}</button>
      )}
    </div>
  );
}
