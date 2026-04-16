import type { SaveData } from '../types';

const SAVE_KEY = 'td_save_v1';

const DEFAULT_SAVE: SaveData = {
  version: 2,
  shards: 0,
  unlockedNodeIds: ['start'],
  unlockLevels: {},
  campaignProgress: {
    currentWorld: 1,
    completedWorlds: [],
    currentNodeId: null,
    visitedNodeIds: [],
    hp: 20,
    mapSeed: 0,
    runActive: false,
  },
  stats: {
    totalRuns: 0,
    totalKills: 0,
    highestWave: 0,
    totalShardsEarned: 0,
  },
  settings: {
    musicVolume: 0.7,
    sfxVolume: 0.8,
    gameSpeed: 1,
  },
};

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load() ?? { ...DEFAULT_SAVE };
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      console.warn('Failed to save game data');
    }
  }

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== DEFAULT_SAVE.version) {
        return this.migrate(parsed);
      }
      return parsed;
    } catch {
      console.warn('Failed to load save data');
      return null;
    }
  }

  private migrate(old: SaveData): SaveData {
    // Fill in any missing top-level keys from defaults; preserve existing values.
    const merged: SaveData = { ...DEFAULT_SAVE, ...old, version: DEFAULT_SAVE.version };
    // v1 → v2: introduced unlockLevels map
    if (!merged.unlockLevels || typeof merged.unlockLevels !== 'object') {
      merged.unlockLevels = {};
    }
    return merged;
  }

  getData(): SaveData {
    return this.data;
  }

  getShards(): number {
    return this.data.shards;
  }

  addShards(amount: number): void {
    this.data.shards += amount;
    this.data.stats.totalShardsEarned += amount;
    this.save();
  }

  spendShards(amount: number): boolean {
    if (this.data.shards < amount) return false;
    this.data.shards -= amount;
    this.save();
    return true;
  }

  unlockNode(nodeId: string): void {
    if (!this.data.unlockedNodeIds.includes(nodeId)) {
      this.data.unlockedNodeIds.push(nodeId);
      this.save();
    }
  }

  isNodeUnlocked(nodeId: string): boolean {
    return this.data.unlockedNodeIds.includes(nodeId);
  }

  getNodeLevel(nodeId: string): number {
    return this.data.unlockLevels?.[nodeId] ?? 0;
  }

  incrementNodeLevel(nodeId: string): number {
    if (!this.data.unlockLevels) this.data.unlockLevels = {};
    const next = (this.data.unlockLevels[nodeId] ?? 0) + 1;
    this.data.unlockLevels[nodeId] = next;
    // Keep unlockedNodeIds in sync so `isNodeUnlocked` works for UI state.
    if (!this.data.unlockedNodeIds.includes(nodeId)) {
      this.data.unlockedNodeIds.push(nodeId);
    }
    this.save();
    return next;
  }

  recordRun(kills: number, highestWave: number): void {
    this.data.stats.totalRuns++;
    this.data.stats.totalKills += kills;
    if (highestWave > this.data.stats.highestWave) {
      this.data.stats.highestWave = highestWave;
    }
    this.save();
  }

  reset(): void {
    this.data = { ...DEFAULT_SAVE };
    this.save();
  }
}
