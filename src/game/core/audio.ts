// WebAudio: one music track at a time (looped, cross-faded) and fire-and-forget effects. Paths are relative to /assets/.
import { arrayBuffer } from './assets';

let ctx: AudioContext | null = null;
let fxGain: GainNode, musicGain: GainNode;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let music: { src: AudioBufferSourceNode; gain: GainNode; path: string } | null = null;
let wanted = '';
let soundOn = true;
let musicOn = true;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    fxGain = ctx.createGain();
    musicGain = ctx.createGain();
    fxGain.connect(ctx.destination);
    musicGain.connect(ctx.destination);
    musicGain.gain.value = 0.7;
  }
  return ctx;
}

export function unlockAudio(): void {
  const c = ac();
  if (c.state === 'suspended') void c.resume();
}

function buffer(path: string): Promise<AudioBuffer | null> {
  let p = buffers.get(path);
  if (!p) {
    p = arrayBuffer(path).then((b) => (b ? ac().decodeAudioData(b) : null)).catch(() => null);
    buffers.set(path, p);
  }
  return p;
}

export function preloadSounds(paths: string[]): Promise<unknown> {
  return Promise.all(paths.map(buffer));
}

export function playSound(path: string, volume = 1): void {
  if (!soundOn) return;
  void buffer(path).then((b) => {
    if (!b) return;
    const s = ac().createBufferSource();
    s.buffer = b;
    if (volume !== 1) {
      const g = ac().createGain();
      g.gain.value = volume;
      s.connect(g); g.connect(fxGain);
    } else s.connect(fxGain);
    s.start();
  });
}

export function playMusic(path: string, volume = 1): void {
  if (wanted === path && music) return;
  stopMusic();
  wanted = path;
  if (!musicOn) return;
  void buffer(path).then((b) => {
    if (!b || wanted !== path || music) return;
    const c = ac();
    const s = c.createBufferSource();
    s.buffer = b;
    s.loop = true;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(volume, c.currentTime + 0.6);
    s.connect(g); g.connect(musicGain);
    s.start();
    music = { src: s, gain: g, path };
  });
}

export function stopMusic(): void {
  wanted = '';
  if (music) {
    const m = music;
    music = null;
    try {
      const c = ac();
      m.gain.gain.cancelScheduledValues(c.currentTime);
      m.gain.gain.setValueAtTime(m.gain.gain.value, c.currentTime);
      m.gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.4);
      m.src.stop(c.currentTime + 0.45);
    } catch { /* already stopped */ }
  }
}

export function setSoundEnabled(on: boolean): void { soundOn = on; }
export function setMusicEnabled(on: boolean): void { musicOn = on; if (!on) stopMusic(); }
export function isSoundOn(): boolean { return soundOn; }
export function isMusicOn(): boolean { return musicOn; }
