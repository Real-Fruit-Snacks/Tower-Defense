import { Element } from './constants';

// ============ TOWER TYPES ============

export interface TowerConfig {
  id: string;
  name: string;
  element: Element | null; // null = neutral
  baseCost: number;
  baseRange: number; // in grid cells
  baseDamage: number;
  attackSpeed: number; // attacks per second
  description: string;
  shape: TowerShape;
}

export type TowerShape =
  | 'triangle'
  | 'square'
  | 'pentagon'
  | 'hexagon'
  | 'diamond'
  | 'octagon'
  | 'star'
  | 'circle';

export interface UpgradeLevel {
  cost: number;
  damageBoost: number; // multiplier added (e.g. 0.2 = +20%)
  rangeBoost: number;
  speedBoost: number;
  description: string;
  special?: string; // special effect description
}

export interface UpgradeBranch {
  branchName: string;
  levels: [UpgradeLevel, UpgradeLevel, UpgradeLevel];
}

// ============ ENEMY TYPES ============

export interface EnemyConfig {
  id: string;
  name: string;
  shape: EnemyShape;
  baseHP: number;
  baseSpeed: number; // pixels per second
  reward: number; // gold on kill
  description: string;
  special?: string; // special behavior
}

export type EnemyShape =
  | 'circle'
  | 'triangle'
  | 'square'
  | 'pentagon'
  | 'hexagon'
  | 'diamond'
  | 'star'
  | 'octagon';

// ============ WAVE TYPES ============

export interface EnemyGroup {
  enemyId: string;
  element: Element;
  count: number;
  interval: number; // ms between spawns
  delay: number; // ms delay before this group starts
  entryIndex?: number; // which entry point to spawn from (default 0)
}

export interface WaveDefinition {
  waveNumber: number;
  groups: EnemyGroup[];
  bonusGold: number;
}

// ============ GRID TYPES ============

export interface GridCell {
  row: number;
  col: number;
  occupied: boolean;
  towerId: string | null;
  isEntry: boolean;
  isExit: boolean;
  isObstacle: boolean;
}

export interface GridPosition {
  row: number;
  col: number;
}

// ============ CAMPAIGN TYPES ============

export type NodeType = 'battle' | 'shop' | 'elite' | 'boss' | 'event' | 'rest';

export interface NodeMapNode {
  id: string;
  type: NodeType;
  connections: string[];
  x: number;
  y: number;
  difficulty?: number;
  rewards?: NodeReward;
  worldId?: number;
  seed?: number;
  layoutHint?: LayoutType;
}

// ============ LEVEL GENERATION TYPES ============

export type LayoutType =
  | 'open_field'
  | 'island'
  | 'corridors'
  | 'split_path'
  | 'gauntlet'
  | 'fortress';

export interface LevelConfig {
  seed: number;
  gridObstacles: GridPosition[];
  entryPoints: GridPosition[];
  exitPoints: GridPosition[];
  waves: WaveDefinition[];
  startingGold: number;
  waveCount: number;
  layoutType: LayoutType;
  difficultyRating: number;
}

export interface NodeReward {
  gold?: number;
  shards?: number;
  healing?: number;
}

// ============ CHALLENGE TYPES ============

export type ChallengeModifier =
  | { type: 'ban_tower'; towerId: string }
  | { type: 'ban_element'; element: Element }
  | { type: 'only_element'; element: Element }
  | { type: 'enemy_hp_mult'; value: number }
  | { type: 'enemy_speed_mult'; value: number }
  | { type: 'starting_gold'; value: number }
  | { type: 'starting_hp'; value: number }
  | { type: 'gold_mult'; value: number }
  | { type: 'tower_limit'; value: number }
  | { type: 'no_sell' }
  | { type: 'no_upgrades' }
  | { type: 'wave_count'; value: number }
  | { type: 'force_layout'; layout: LayoutType };

export interface ChallengeConfig {
  id: string;
  name: string;
  description: string;
  modifiers: ChallengeModifier[];
  difficulty: 1 | 2 | 3 | 4 | 5; // star rating
  shardReward: number;
}

// ============ ROGUELITE TYPES ============

export interface UnlockNode {
  id: string;
  name: string;
  description: string;
  cost: number; // shards (base cost; repeatable nodes scale by costStep * level)
  prereqs: string[]; // IDs of prerequisite nodes
  effect: UnlockEffect;
  /**
   * If true, the node can be purchased multiple times. Current level stored
   * in SaveData.unlockLevels. Passive bonuses scale with level. Classic
   * one-shot unlocks (towers, modes) leave this undefined.
   */
  repeatable?: boolean;
  /** For repeatable nodes: extra cost per owned level on top of `cost`. */
  costStep?: number;
  /** For repeatable nodes: max level (undefined = infinite shard sink). */
  maxLevel?: number;
}

export type UnlockEffect =
  | { type: 'unlock_tower'; towerId: string }
  | { type: 'unlock_upgrade'; towerId: string; branchIndex: number }
  | { type: 'passive_bonus'; stat: string; value: number }
  | { type: 'unlock_mode'; mode: string };

// ============ SAVE TYPES ============

export interface SaveData {
  version: number;
  shards: number;
  unlockedNodeIds: string[];
  /**
   * For repeatable unlock nodes, tracks how many times they've been purchased.
   * Absent / 0 = never bought. For one-shot nodes this is not used.
   */
  unlockLevels: Record<string, number>;
  campaignProgress: CampaignProgress;
  stats: PlayerStats;
  settings: GameSettings;
}

export interface CampaignProgress {
  currentWorld: number;
  completedWorlds: number[];
  currentNodeId: string | null;
  visitedNodeIds: string[];
  hp: number;
  mapSeed: number;
  runActive: boolean;
}

export interface PlayerStats {
  totalRuns: number;
  totalKills: number;
  highestWave: number;
  totalShardsEarned: number;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  gameSpeed: number;
  autoStartWaves: boolean;
}

// ============ EVENT TYPES ============

export interface GameEvents extends Record<string, unknown> {
  ENEMY_KILLED: { enemyId: string; reward: number; element: Element; isBoss: boolean };
  ENEMY_LEAKED: { damage: number };
  TOWER_PLACED: { towerId: string; row: number; col: number; cost: number };
  TOWER_SOLD: { towerId: string; row: number; col: number; refund: number };
  TOWER_UPGRADED: { towerId: string; branch: number; level: number; cost: number };
  TOWER_SELECTED: { towerId: string | null };
  WAVE_START: { waveNumber: number };
  WAVE_END: { waveNumber: number; bonusGold: number };
  GOLD_CHANGED: { gold: number; delta: number };
  HP_CHANGED: { hp: number; delta: number };
  GAME_STATE_CHANGED: { state: GameState };
  PATH_UPDATED: { waypoints: GridPosition[] };
  PLACEMENT_REJECTED: { row: number; col: number; reason: string };
}

export type GameState = 'menu' | 'build' | 'wave' | 'boss' | 'gameover' | 'victory';
