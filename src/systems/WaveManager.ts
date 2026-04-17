import Phaser from 'phaser';
import type { GameEvents, WaveDefinition, EnemyGroup, EnemyConfig, GridPosition } from '../types';
import { EventBus } from '../utils/EventBus';
import { EnemyFactory } from '../entities/enemies/EnemyFactory';
import { EnemyManager } from '../entities/enemies/EnemyManager';

type WaveState = 'idle' | 'spawning' | 'active' | 'complete';

interface SpawnTask {
  group: EnemyGroup;
  config: EnemyConfig;
  spawned: number;
  nextSpawnTime: number;
  startTime: number;
}

/**
 * Wave source — either a finite array of waves (campaign / challenges) or
 * a function that generates waves on demand (endless mode).
 */
export type WaveProvider = WaveDefinition[] | ((index: number) => WaveDefinition | undefined);

export class WaveManager {
  private scene: Phaser.Scene;
  private events: EventBus<GameEvents>;
  private enemyManager: EnemyManager;
  private enemyConfigs: Map<string, EnemyConfig>;
  private waves: WaveProvider;
  private getPath: (entryIndex?: number) => GridPosition[];

  private state: WaveState = 'idle';
  private currentWaveIndex = 0;
  private spawnTasks: SpawnTask[] = [];
  private waveStartTime = 0;
  private waveMultiplier = 1;
  private speedMultiplier = 1;

  constructor(
    scene: Phaser.Scene,
    events: EventBus<GameEvents>,
    enemyManager: EnemyManager,
    enemyConfigs: EnemyConfig[],
    waves: WaveProvider,
    getPath: (entryIndex?: number) => GridPosition[],
  ) {
    this.scene = scene;
    this.events = events;
    this.enemyManager = enemyManager;
    this.waves = waves;
    this.getPath = getPath;

    this.enemyConfigs = new Map();
    for (const config of enemyConfigs) {
      this.enemyConfigs.set(config.id, config);
    }
  }

  /** Accessor that works for both array and lazy providers */
  private getWaveAt(index: number): WaveDefinition | undefined {
    if (typeof this.waves === 'function') {
      return this.waves(index);
    }
    if (index < 0 || index >= this.waves.length) return undefined;
    return this.waves[index];
  }

  /** True when the provider is a lazy function (endless mode) */
  private isLazy(): boolean {
    return typeof this.waves === 'function';
  }

  startWave(): void {
    if (this.state !== 'idle') return;

    const wave = this.getWaveAt(this.currentWaveIndex);
    if (!wave) return; // no more waves (only happens for finite providers)

    this.state = 'spawning';
    this.waveStartTime = this.scene.time.now;
    this.spawnTasks = [];

    for (const group of wave.groups) {
      const config = this.enemyConfigs.get(group.enemyId);
      if (!config) continue;

      this.spawnTasks.push({
        group,
        config,
        spawned: 0,
        nextSpawnTime: this.waveStartTime + group.delay,
        startTime: this.waveStartTime + group.delay,
      });
    }

    this.events.emit('WAVE_START', { waveNumber: this.currentWaveIndex + 1 });
    this.events.emit('GAME_STATE_CHANGED', {
      state: wave.groups.some(g => {
        const c = this.enemyConfigs.get(g.enemyId);
        return c?.special === 'boss';
      }) ? 'boss' : 'wave',
    });
  }

  update(time: number, _delta: number): void {
    if (this.state === 'spawning') {
      let allDone = true;

      for (const task of this.spawnTasks) {
        if (task.spawned >= task.group.count) continue;
        allDone = false;

        if (time >= task.nextSpawnTime) {
          const path = this.getPath(task.group.entryIndex ?? 0);
          const enemy = EnemyFactory.create(
            this.scene,
            task.config,
            task.group.element,
            this.waveMultiplier,
            this.speedMultiplier,
          );
          this.enemyManager.addEnemy(enemy, path);
          task.spawned++;
          task.nextSpawnTime = time + task.group.interval;
        }
      }

      if (allDone) {
        this.state = 'active';
      }
    }

    if (this.state === 'active') {
      if (this.enemyManager.getEnemyCount() === 0) {
        this.completeWave();
      }
    }
  }

  private completeWave(): void {
    // IMPORTANT: advance currentWaveIndex and reset state BEFORE emitting
    // WAVE_END. The GameScene listener checks `isAllWavesComplete()` in
    // its handler — that check requires `currentWaveIndex >= waves.length
    // && state === 'idle'`. If we emitted first, the check would always
    // return false on the real last wave (state still 'complete', index
    // not yet incremented), so the game would never trigger victory and
    // would sit idle after the final wave.
    const completedIndex = this.currentWaveIndex;
    const wave = this.getWaveAt(completedIndex);
    this.currentWaveIndex = completedIndex + 1;
    this.state = 'idle';

    this.events.emit('WAVE_END', {
      waveNumber: completedIndex + 1, // 1-based wave number that just ended
      bonusGold: wave?.bonusGold ?? 0,
    });
    this.events.emit('GAME_STATE_CHANGED', { state: 'build' });
  }

  getCurrentWave(): number {
    return this.currentWaveIndex + 1;
  }

  /** Returns Infinity for lazy providers */
  getTotalWaves(): number {
    if (typeof this.waves === 'function') return Infinity;
    return this.waves.length;
  }

  getState(): WaveState {
    return this.state;
  }

  /** Lazy providers never complete — they're infinite */
  isAllWavesComplete(): boolean {
    if (this.isLazy()) return false;
    return this.currentWaveIndex >= (this.waves as WaveDefinition[]).length && this.state === 'idle';
  }

  setWaveMultiplier(mult: number): void {
    this.waveMultiplier = mult;
  }

  setSpeedMultiplier(mult: number): void {
    this.speedMultiplier = mult;
  }

  /** Peek at a specific wave (for wave preview UI) */
  peekWave(index: number): WaveDefinition | undefined {
    return this.getWaveAt(index);
  }
}
