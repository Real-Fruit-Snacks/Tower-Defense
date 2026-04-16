import type { GameState } from '../types';

interface AudioLayer {
  id: string;
  volume: number;
  targetVolume: number;
}

type SFXType = 'tower_fire' | 'enemy_kill' | 'enemy_leak' | 'tower_place' | 'tower_sell'
  | 'upgrade' | 'wave_start' | 'wave_clear' | 'ui_click' | 'ui_hover' | 'boss_alert' | 'rejection';

const SFX_CONFIGS: Record<SFXType, { freq: number; duration: number; type: OscillatorType; ramp?: number }> = {
  tower_fire: { freq: 800, duration: 0.06, type: 'square', ramp: 400 },
  enemy_kill: { freq: 600, duration: 0.1, type: 'sine', ramp: 200 },
  enemy_leak: { freq: 200, duration: 0.2, type: 'sawtooth' },
  tower_place: { freq: 500, duration: 0.12, type: 'sine', ramp: 700 },
  tower_sell: { freq: 400, duration: 0.1, type: 'triangle', ramp: 200 },
  upgrade: { freq: 600, duration: 0.15, type: 'sine', ramp: 900 },
  wave_start: { freq: 440, duration: 0.3, type: 'sine', ramp: 660 },
  wave_clear: { freq: 523, duration: 0.4, type: 'sine', ramp: 784 },
  ui_click: { freq: 1000, duration: 0.04, type: 'square', ramp: 600 },
  ui_hover: { freq: 1200, duration: 0.02, type: 'sine' },
  boss_alert: { freq: 150, duration: 0.5, type: 'sawtooth', ramp: 80 },
  rejection: { freq: 200, duration: 0.15, type: 'square', ramp: 100 },
};

/**
 * Audio manager with procedural synth SFX and adaptive layer system.
 * Uses Web Audio API oscillators for sound effects.
 */
export class AudioManager {
  private layers: Map<string, AudioLayer> = new Map();
  private currentState: GameState = 'menu';
  private masterVolume = 0.7;
  private sfxVolume = 0.5;
  private audioCtx: AudioContext | null = null;

  private stateConfigs: Record<GameState, Record<string, number>> = {
    menu: { ambient: 0.3 },
    build: { ambient: 0.4, percussion: 0 },
    wave: { ambient: 0.3, percussion: 0.6, melody: 0.3 },
    boss: { ambient: 0.2, percussion: 0.8, melody: 0.6, bass: 0.7 },
    gameover: { ambient: 0.5 },
    victory: { ambient: 0.3, melody: 0.5 },
  };

  constructor() {
    for (const layerId of ['ambient', 'percussion', 'melody', 'bass']) {
      this.layers.set(layerId, { id: layerId, volume: 0, targetVolume: 0 });
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  setGameState(state: GameState): void {
    this.currentState = state;
    const config = this.stateConfigs[state];
    if (!config) return;

    for (const [layerId, layer] of this.layers) {
      layer.targetVolume = config[layerId] ?? 0;
    }
  }

  update(delta: number): void {
    const fadeSpeed = 2;
    const step = fadeSpeed * (delta / 1000);

    for (const layer of this.layers.values()) {
      if (Math.abs(layer.volume - layer.targetVolume) < step) {
        layer.volume = layer.targetVolume;
      } else if (layer.volume < layer.targetVolume) {
        layer.volume += step;
      } else {
        layer.volume -= step;
      }
    }
  }

  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  getLayerVolume(layerId: string): number {
    return (this.layers.get(layerId)?.volume ?? 0) * this.masterVolume;
  }

  /** Play a procedural synth sound effect */
  playSFX(key: string): void {
    const config = SFX_CONFIGS[key as SFXType];
    if (!config) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const volume = this.sfxVolume * this.masterVolume;
    if (volume <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = config.type;
    osc.frequency.setValueAtTime(config.freq, now);
    if (config.ramp) {
      osc.frequency.linearRampToValueAtTime(config.ramp, now + config.duration);
    }

    gain.gain.setValueAtTime(volume * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + config.duration + 0.01);
  }
}

/** Global audio manager singleton */
export const audioManager = new AudioManager();
