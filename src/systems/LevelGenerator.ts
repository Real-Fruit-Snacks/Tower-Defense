import { GRID } from '../constants';
import { Element } from '../constants';
import type { LevelConfig, LayoutType, WaveDefinition, EnemyGroup, GridPosition, NodeType } from '../types';
import { LAYOUT_TEMPLATES, SeededRNG } from '../data/levelLayouts';
import { PriorityQueue } from '../utils/PriorityQueue';

// ---------------------------------------------------------------------------
// WorldGenConfig — will be imported from data/worldMap.ts once it exists there
// ---------------------------------------------------------------------------
export interface WorldGenConfig {
  id: number;
  difficulty: number;
  layoutWeights: Record<LayoutType, number>;
  elementWeights: Record<Element, number>;
  baseThreatBudget: number;
  baseWaveRange: [number, number];
  startingGold: number;
  enemyPool: string[];
  bossElement: Element;
}

// ---------------------------------------------------------------------------
// LevelGenParams
// ---------------------------------------------------------------------------
export interface LevelGenParams {
  seed: number;
  worldId: number;
  nodeDifficulty: number;
  nodeType: NodeType;
  worldConfig: WorldGenConfig;
  /** Optional: force a specific layout instead of random selection. Boss nodes still override to 'fortress'. */
  forceLayout?: LayoutType;
  /** Optional: override the number of waves. */
  forceWaveCount?: number;
}

// ---------------------------------------------------------------------------
// Threat cost & availability tables
// ---------------------------------------------------------------------------
const THREAT_COSTS: Record<string, number> = {
  runner: 1,
  tank: 3,
  striker: 2,
  shielded: 3,
  splitter: 2,
  healer: 4,
  elite: 6,
  boss: 15,
};

const MIN_WAVE: Record<string, number> = {
  runner: 0,
  tank: 0,
  striker: 1,
  shielded: 2,
  splitter: 2,
  healer: 3,
  elite: 3,
  boss: 99, // boss is only added manually on boss waves
};

// ---------------------------------------------------------------------------
// LevelGenerator — core procedural level generation engine
// ---------------------------------------------------------------------------
export class LevelGenerator {
  // =========================================================================
  // Public API
  // =========================================================================

  static generate(params: LevelGenParams): LevelConfig {
    const { seed, nodeDifficulty, nodeType, worldConfig, forceLayout, forceWaveCount } = params;
    const rng = new SeededRNG(seed);

    // --- Step A: Select layout type ---
    const layoutType = this.selectLayout(rng, nodeType, nodeDifficulty, worldConfig, forceLayout);

    // --- Step B: Generate grid layout ---
    const { obstacles, entries, exits } = this.generateGrid(rng, layoutType);

    // --- Step C: Wave parameters ---
    const waveCount = forceWaveCount ?? this.determineWaveCount(rng, nodeType, worldConfig);
    const difficultyMultiplier = 1 + (nodeDifficulty - 1) * 0.3;

    // --- Step D: Generate waves ---
    const waves = this.generateWaves(
      rng,
      waveCount,
      difficultyMultiplier,
      nodeDifficulty,
      nodeType,
      worldConfig,
      entries,
      layoutType,
    );

    // --- Step E: Starting gold ---
    let startingGold = worldConfig.startingGold;
    if (nodeType === 'elite') startingGold -= 25;
    if (nodeType === 'boss') startingGold += 50;
    startingGold = Math.max(0, startingGold);

    // --- Step F: Assemble LevelConfig ---
    return {
      seed,
      gridObstacles: obstacles,
      entryPoints: entries,
      exitPoints: exits,
      waves,
      startingGold,
      waveCount,
      layoutType,
      difficultyRating: nodeDifficulty,
    };
  }

  // =========================================================================
  // Step A — Layout selection
  // =========================================================================

  private static selectLayout(
    rng: SeededRNG,
    nodeType: NodeType,
    nodeDifficulty: number,
    worldConfig: WorldGenConfig,
    forceLayout?: LayoutType,
  ): LayoutType {
    // Boss nodes always use 'fortress' (takes precedence over forceLayout)
    if (nodeType === 'boss') return 'fortress';

    // If a specific layout was requested, use it
    if (forceLayout) return forceLayout;

    // Build weighted pool, applying elite minimum-difficulty filter
    const entries = Object.entries(worldConfig.layoutWeights) as [LayoutType, number][];
    // Elite nodes could filter for harder layouts (future enhancement)
    const _minDifficulty = nodeType === 'elite' ? nodeDifficulty + 1 : nodeDifficulty;

    // Filter: keep layouts whose weight > 0 (difficulty filtering is soft —
    // we keep all entries but could later add per-layout min-difficulty)
    const pool: { layout: LayoutType; weight: number }[] = [];
    let totalWeight = 0;

    for (const [layout, weight] of entries) {
      if (weight <= 0) continue;
      // 'fortress' is reserved for boss nodes (already handled above)
      if (layout === 'fortress') continue;
      pool.push({ layout, weight });
      totalWeight += weight;
    }

    // Fallback
    if (pool.length === 0 || totalWeight <= 0) return 'open_field';

    let roll = rng.next() * totalWeight;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry.layout;
    }

    return pool[pool.length - 1]!.layout;
  }

  // =========================================================================
  // Step B — Grid generation + validation
  // =========================================================================

  private static generateGrid(
    rng: SeededRNG,
    layoutType: LayoutType,
  ): { obstacles: GridPosition[]; entries: GridPosition[]; exits: GridPosition[] } {
    const template = LAYOUT_TEMPLATES[layoutType];
    const result = template.generate(rng);
    const obstacles = [...result.obstacles];
    const entries = result.entryPoints;
    const exits = result.exitPoints;

    // Validate — remove obstacles one-by-one until all paths exist
    while (!this.validatePaths(obstacles, entries, exits)) {
      if (obstacles.length === 0) break;
      // Remove a random obstacle
      const idx = Math.floor(rng.next() * obstacles.length);
      obstacles.splice(idx, 1);
    }

    return { obstacles, entries, exits };
  }

  // =========================================================================
  // Step C — Wave count
  // =========================================================================

  private static determineWaveCount(
    rng: SeededRNG,
    nodeType: NodeType,
    worldConfig: WorldGenConfig,
  ): number {
    let count = rng.intRange(worldConfig.baseWaveRange[0], worldConfig.baseWaveRange[1]);

    if (nodeType === 'elite') count = Math.min(count + 2, 12);
    if (nodeType === 'boss') count += 1;

    return count;
  }

  // =========================================================================
  // Step D — Wave generation via threat budget
  // =========================================================================

  private static generateWaves(
    rng: SeededRNG,
    waveCount: number,
    difficultyMultiplier: number,
    nodeDifficulty: number,
    nodeType: NodeType,
    worldConfig: WorldGenConfig,
    entries: GridPosition[],
    layoutType: LayoutType,
  ): WaveDefinition[] {
    const waves: WaveDefinition[] = [];
    const isSplitPath = layoutType === 'split_path';
    const isBoss = nodeType === 'boss';

    for (let i = 0; i < waveCount; i++) {
      const isLastWave = i === waveCount - 1;
      let budget = worldConfig.baseThreatBudget * (1 + i * 0.3) * difficultyMultiplier;

      // Determine 1-3 elements for this wave
      const waveElements = this.pickWaveElements(rng, worldConfig.elementWeights);

      const groups: EnemyGroup[] = [];
      let groupIndex = 0;

      // Boss final wave: force-add the boss enemy first
      if (isBoss && isLastWave) {
        const bossCost = THREAT_COSTS['boss']!;
        groups.push({
          enemyId: 'boss',
          element: worldConfig.bossElement,
          count: 1,
          interval: 1000,
          delay: 0,
          ...(isSplitPath && entries.length > 1 ? { entryIndex: 0 } : {}),
        });
        budget -= bossCost;
        groupIndex++;

        // Fill remaining budget with elites and shielded
        budget = this.fillBossRemaining(
          rng,
          budget,
          waveElements,
          groups,
          groupIndex,
          isSplitPath,
          entries,
          nodeDifficulty,
        );
      } else {
        // Normal wave spending
        budget = this.spendBudget(
          rng,
          budget,
          i,
          nodeType,
          worldConfig,
          waveElements,
          groups,
          groupIndex,
          isSplitPath,
          entries,
          nodeDifficulty,
        );
      }

      const bonusGold = Math.floor(10 + i * 5 * difficultyMultiplier);

      waves.push({
        waveNumber: i + 1,
        groups,
        bonusGold,
      });
    }

    return waves;
  }

  // -------------------------------------------------------------------------
  // Budget spending for normal waves
  // -------------------------------------------------------------------------

  private static spendBudget(
    rng: SeededRNG,
    budget: number,
    waveIndex: number,
    nodeType: NodeType,
    worldConfig: WorldGenConfig,
    waveElements: Element[],
    groups: EnemyGroup[],
    groupIndex: number,
    isSplitPath: boolean,
    entries: GridPosition[],
    nodeDifficulty: number,
  ): number {
    // Filter available enemies
    const available = worldConfig.enemyPool.filter((enemyId) => {
      let minWave = MIN_WAVE[enemyId] ?? 99;
      // Elite nodes unlock the 'elite' enemy type earlier
      if (nodeType === 'elite' && enemyId === 'elite') minWave = 1;
      return waveIndex >= minWave;
    });

    if (available.length === 0) return budget;

    // Find minimum enemy cost for stopping condition
    const minCost = Math.min(...available.map((id) => THREAT_COSTS[id] ?? 1));

    while (budget >= minCost) {
      // Pick random enemy type
      const enemyId = available[Math.floor(rng.next() * available.length)]!;
      const cost = THREAT_COSTS[enemyId] ?? 1;

      if (cost > budget) continue;

      // Pick random element from wave element pool
      const element = waveElements[Math.floor(rng.next() * waveElements.length)]!;

      // Determine count
      const maxByBudget = Math.floor(budget / cost);
      const maxCount = Math.min(8, maxByBudget);
      if (maxCount < 2) {
        // Can only afford 1 — add it and move on
        if (budget >= cost) {
          const interval = this.scaledInterval(rng, nodeDifficulty);
          const delay = groupIndex === 0 ? 0 : rng.intRange(1500, 3500);

          const group: EnemyGroup = {
            enemyId,
            element,
            count: 1,
            interval,
            delay,
          };

          if (isSplitPath && entries.length > 1) {
            group.entryIndex = groupIndex % 2;
          }

          groups.push(group);
          groupIndex++;
          budget -= cost;
        }
        break;
      }

      const count = rng.intRange(2, maxCount);
      const interval = this.scaledInterval(rng, nodeDifficulty);
      const delay = groupIndex === 0 ? 0 : rng.intRange(1500, 3500);

      const group: EnemyGroup = {
        enemyId,
        element,
        count,
        interval,
        delay,
      };

      if (isSplitPath && entries.length > 1) {
        group.entryIndex = groupIndex % 2;
      }

      groups.push(group);
      groupIndex++;
      budget -= cost * count;
    }

    return budget;
  }

  // -------------------------------------------------------------------------
  // Boss final-wave remaining-budget filler
  // -------------------------------------------------------------------------

  private static fillBossRemaining(
    rng: SeededRNG,
    budget: number,
    waveElements: Element[],
    groups: EnemyGroup[],
    groupIndex: number,
    isSplitPath: boolean,
    entries: GridPosition[],
    nodeDifficulty: number,
  ): number {
    const bossPool = ['elite', 'shielded'];
    const minCost = Math.min(...bossPool.map((id) => THREAT_COSTS[id] ?? 1));

    while (budget >= minCost) {
      const enemyId = bossPool[Math.floor(rng.next() * bossPool.length)]!;
      const cost = THREAT_COSTS[enemyId] ?? 1;

      if (cost > budget) continue;

      const element = waveElements[Math.floor(rng.next() * waveElements.length)]!;
      const maxByBudget = Math.floor(budget / cost);
      const maxCount = Math.min(8, maxByBudget);
      const count = maxCount < 2 ? 1 : rng.intRange(2, maxCount);

      const interval = this.scaledInterval(rng, nodeDifficulty);
      const delay = groupIndex === 0 ? 0 : rng.intRange(1500, 3500);

      const group: EnemyGroup = {
        enemyId,
        element,
        count,
        interval,
        delay,
      };

      if (isSplitPath && entries.length > 1) {
        group.entryIndex = groupIndex % 2;
      }

      groups.push(group);
      groupIndex++;
      budget -= cost * count;
    }

    return budget;
  }

  // -------------------------------------------------------------------------
  // Helpers for wave generation
  // -------------------------------------------------------------------------

  /** Pick 1-3 elements weighted by worldConfig.elementWeights + RNG */
  private static pickWaveElements(
    rng: SeededRNG,
    elementWeights: Record<Element, number>,
  ): Element[] {
    const count = rng.intRange(1, 3);
    const entries = Object.entries(elementWeights) as [Element, number][];
    const picked: Element[] = [];
    const remaining = [...entries];

    for (let i = 0; i < count && remaining.length > 0; i++) {
      const currentTotal = remaining.reduce((sum, [, w]) => sum + w, 0);
      if (currentTotal <= 0) break;

      let roll = rng.next() * currentTotal;
      let chosenIdx = remaining.length - 1;

      for (let j = 0; j < remaining.length; j++) {
        roll -= remaining[j]![1];
        if (roll <= 0) {
          chosenIdx = j;
          break;
        }
      }

      picked.push(remaining[chosenIdx]![0]);
      remaining.splice(chosenIdx, 1);
    }

    // Guarantee at least one element
    if (picked.length === 0) {
      picked.push(entries[0]![0]);
    }

    return picked;
  }

  /** Generate a spawn interval scaled by difficulty */
  private static scaledInterval(rng: SeededRNG, nodeDifficulty: number): number {
    const base = rng.intRange(800, 1500);
    return Math.round(base / (1 + (nodeDifficulty - 1) * 0.15));
  }

  // =========================================================================
  // Path validation — simplified A* (inline, used only at generation time)
  // =========================================================================

  private static validatePaths(
    obstacles: GridPosition[],
    entries: GridPosition[],
    exits: GridPosition[],
  ): boolean {
    // Build obstacle lookup set for O(1) checks
    const obstacleSet = new Set<string>();
    for (const obs of obstacles) {
      obstacleSet.add(`${obs.row},${obs.col}`);
    }

    // For each entry → each exit, run A*. All pairs must have a path.
    for (const entry of entries) {
      for (const exit of exits) {
        if (!this.astar(entry, exit, obstacleSet)) {
          return false;
        }
      }
    }

    return true;
  }

  /** Run A* on the grid. Returns true if a path exists. */
  private static astar(
    start: GridPosition,
    goal: GridPosition,
    obstacleSet: Set<string>,
  ): boolean {
    const rows = GRID.ROWS;
    const cols = GRID.COLS;

    const key = (r: number, c: number): string => `${r},${c}`;

    // Manhattan distance heuristic
    const heuristic = (r: number, c: number): number =>
      Math.abs(r - goal.row) + Math.abs(c - goal.col);

    const pq = new PriorityQueue<{ row: number; col: number }>();
    const gScore = new Map<string, number>();
    const closed = new Set<string>();

    const startKey = key(start.row, start.col);
    gScore.set(startKey, 0);
    pq.insert({ row: start.row, col: start.col }, heuristic(start.row, start.col));

    const neighbors: [number, number][] = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    while (!pq.isEmpty()) {
      const current = pq.extractMin()!;
      const currentKey = key(current.row, current.col);

      if (current.row === goal.row && current.col === goal.col) {
        return true;
      }

      if (closed.has(currentKey)) continue;
      closed.add(currentKey);

      const currentG = gScore.get(currentKey) ?? Infinity;

      for (const [dr, dc] of neighbors) {
        const nr = current.row + dr;
        const nc = current.col + dc;

        // Bounds check
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

        const nKey = key(nr, nc);

        // Skip obstacles (but allow goal position even if marked — entries/exits
        // should never be obstacles, but be safe)
        if (obstacleSet.has(nKey) && !(nr === goal.row && nc === goal.col)) continue;

        if (closed.has(nKey)) continue;

        const tentativeG = currentG + 1;
        const prevG = gScore.get(nKey) ?? Infinity;

        if (tentativeG < prevG) {
          gScore.set(nKey, tentativeG);
          const f = tentativeG + heuristic(nr, nc);
          pq.insert({ row: nr, col: nc }, f);
        }
      }
    }

    return false;
  }

  // =========================================================================
  // Endless mode generation
  // =========================================================================

  /** Dedicated endless-mode world config. Used for the initial map generation. */
  private static readonly ENDLESS_CONFIG: WorldGenConfig = {
    id: 999,
    difficulty: 2,
    // Fortress excluded — we want player to build their own maze
    layoutWeights: {
      open_field: 25,
      island: 25,
      corridors: 20,
      split_path: 15,
      gauntlet: 15,
      fortress: 0,
    },
    // Equal-ish element weights (all 6 elements appear)
    elementWeights: {
      [Element.Fire]: 1,
      [Element.Wind]: 1,
      [Element.Earth]: 1,
      [Element.Lightning]: 1,
      [Element.Water]: 1,
      [Element.Void]: 1,
    },
    baseThreatBudget: 5,
    baseWaveRange: [1, 1], // unused — waves are generated lazily
    startingGold: 300,
    enemyPool: ['runner', 'tank', 'striker', 'shielded', 'splitter', 'healer', 'elite'],
    bossElement: Element.Void,
  };

  /**
   * Generate the initial endless-mode level (grid + entries/exits).
   * Waves are NOT included — they are generated lazily via `generateEndlessWave`.
   */
  static generateEndlessLevel(seed: number): LevelConfig {
    const rng = new SeededRNG(seed);
    // Pick a random layout from the endless weights (excludes fortress)
    const layoutType = this.selectLayout(rng, 'battle', 1, this.ENDLESS_CONFIG);
    const { obstacles, entries, exits } = this.generateGrid(rng, layoutType);

    return {
      seed,
      gridObstacles: obstacles,
      entryPoints: entries,
      exitPoints: exits,
      waves: [], // lazy — WaveManager pulls via generateEndlessWave
      startingGold: this.ENDLESS_CONFIG.startingGold,
      waveCount: Infinity,
      layoutType,
      difficultyRating: 1,
    };
  }

  /**
   * HP scaling multiplier for a given endless wave index.
   * Linear curve: +4% per wave. Wave 25 = 2x HP, Wave 50 = 3x HP.
   */
  static endlessHpMultiplier(waveIndex: number): number {
    return 1 + waveIndex * 0.04;
  }

  /**
   * Generate a single endless-mode wave on demand.
   * @param waveIndex 0-based wave index (wave 1 = index 0)
   * @param rng Seeded RNG (shared across all waves of a run for determinism)
   */
  static generateEndlessWave(waveIndex: number, rng: SeededRNG): WaveDefinition {
    const waveNumber = waveIndex + 1;
    const isBossWave = waveNumber % 10 === 0;
    const isEliteWave = !isBossWave && waveNumber % 5 === 0;

    // Linear budget curve: base * (1 + waveIndex * 0.12)
    let budget = this.ENDLESS_CONFIG.baseThreatBudget * (1 + waveIndex * 0.12);
    if (isEliteWave) budget *= 1.4;
    if (isBossWave) budget *= 1.6;

    // Determine 1-3 elements for this wave
    const waveElements = this.pickWaveElements(rng, this.ENDLESS_CONFIG.elementWeights);

    // Enemy pool unlocks progressively
    const pool = this.getEndlessEnemyPool(waveIndex, isEliteWave);

    const groups: EnemyGroup[] = [];
    let groupIndex = 0;

    if (isBossWave) {
      // Boss + support fillers
      const bossCost = THREAT_COSTS['boss']!;
      groups.push({
        enemyId: 'boss',
        element: this.ENDLESS_CONFIG.bossElement,
        count: 1,
        interval: 1000,
        delay: 0,
      });
      budget -= bossCost;
      groupIndex++;

      // Fill remaining with elites + shielded (like campaign boss waves)
      const bossSupport = ['elite', 'shielded'];
      while (budget >= Math.min(...bossSupport.map(id => THREAT_COSTS[id] ?? 99))) {
        const enemyId = bossSupport[Math.floor(rng.next() * bossSupport.length)]!;
        const cost = THREAT_COSTS[enemyId] ?? 3;
        if (cost > budget) break;
        const element = waveElements[Math.floor(rng.next() * waveElements.length)]!;
        const maxByBudget = Math.floor(budget / cost);
        const count = Math.min(6, Math.max(1, maxByBudget));
        groups.push({
          enemyId,
          element,
          count,
          interval: rng.intRange(700, 1200),
          delay: rng.intRange(1500, 3000),
        });
        budget -= cost * count;
        groupIndex++;
      }
    } else {
      // Normal / elite wave — spend budget with gradual enemy pool
      const minCost = Math.min(...pool.map(id => THREAT_COSTS[id] ?? 99));
      while (budget >= minCost) {
        const enemyId = pool[Math.floor(rng.next() * pool.length)]!;
        const cost = THREAT_COSTS[enemyId] ?? 1;
        if (cost > budget) continue;

        const element = waveElements[Math.floor(rng.next() * waveElements.length)]!;
        const maxByBudget = Math.floor(budget / cost);
        const maxCount = Math.min(10, maxByBudget);
        if (maxCount < 2) {
          if (budget >= cost) {
            groups.push({
              enemyId,
              element,
              count: 1,
              interval: this.endlessInterval(rng, waveIndex),
              delay: groupIndex === 0 ? 0 : rng.intRange(1200, 2800),
            });
            budget -= cost;
            groupIndex++;
          }
          break;
        }

        const count = rng.intRange(2, maxCount);
        groups.push({
          enemyId,
          element,
          count,
          interval: this.endlessInterval(rng, waveIndex),
          delay: groupIndex === 0 ? 0 : rng.intRange(1200, 2800),
        });
        budget -= cost * count;
        groupIndex++;
      }
    }

    // Bonus gold scales with wave number
    const bonusGold = Math.floor(15 + waveNumber * 2);

    return {
      waveNumber,
      groups,
      bonusGold,
    };
  }

  /** Enemy pool for endless waves — unlocks more enemies as waves progress */
  private static getEndlessEnemyPool(waveIndex: number, isEliteWave: boolean): string[] {
    const waveNumber = waveIndex + 1;
    const pool: string[] = ['runner', 'tank'];
    if (waveNumber >= 3) pool.push('striker');
    if (waveNumber >= 6) pool.push('shielded');
    if (waveNumber >= 10) pool.push('splitter');
    if (waveNumber >= 15) pool.push('healer');
    if (waveNumber >= 20) pool.push('elite');
    // Elite waves always include elites (even before wave 20)
    if (isEliteWave && !pool.includes('elite')) pool.push('elite');
    return pool;
  }

  /** Spawn interval for endless waves — scales down with wave number */
  private static endlessInterval(rng: SeededRNG, waveIndex: number): number {
    const base = rng.intRange(700, 1300);
    // Slightly faster spawns at higher waves
    return Math.max(300, Math.round(base / (1 + waveIndex * 0.02)));
  }
}
