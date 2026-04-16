import { GRID } from '../constants';
import { GridPosition, LayoutType } from '../types';

// ============ SEEDED RNG (mulberry32) ============

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
}

// ============ LAYOUT RESULT / TEMPLATE TYPES ============

export interface LayoutResult {
  obstacles: GridPosition[];
  entryPoints: GridPosition[];
  exitPoints: GridPosition[];
}

export interface LayoutTemplate {
  type: LayoutType;
  difficultyRating: number;
  generate(rng: SeededRNG): LayoutResult;
}

// ============ HELPERS ============

function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

/** Remove any obstacles that overlap with entry or exit positions. */
function filterObstacles(
  obstacles: GridPosition[],
  entryPoints: GridPosition[],
  exitPoints: GridPosition[],
): GridPosition[] {
  const reserved = new Set<string>();
  for (const p of entryPoints) reserved.add(posKey(p.row, p.col));
  for (const p of exitPoints) reserved.add(posKey(p.row, p.col));
  return obstacles.filter((o) => !reserved.has(posKey(o.row, o.col)));
}

/** Clamp a value within the grid bounds. */
function clampRow(r: number): number {
  return Math.max(0, Math.min(GRID.ROWS - 1, r));
}

function clampCol(c: number): number {
  return Math.max(0, Math.min(GRID.COLS - 1, c));
}

// ============ LAYOUT GENERATORS ============

function generateOpenField(rng: SeededRNG): LayoutResult {
  const entryPoints: GridPosition[] = [{ row: rng.intRange(4, 7), col: 0 }];
  const exitPoints: GridPosition[] = [{ row: rng.intRange(4, 7), col: 19 }];
  return { obstacles: [], entryPoints, exitPoints };
}

function generateIsland(rng: SeededRNG): LayoutResult {
  const entryPoints: GridPosition[] = [{ row: rng.intRange(4, 7), col: 0 }];
  const exitPoints: GridPosition[] = [{ row: rng.intRange(4, 7), col: 19 }];

  // Island center with jitter
  const centerCol = rng.intRange(9, 11) + rng.intRange(-1, 1);
  const centerRow = rng.intRange(4, 7) + rng.intRange(-1, 1);
  const halfW = rng.intRange(1, 2); // width 3-5 (2*halfW+1)
  const halfH = rng.intRange(1, 2); // height 3-5

  const obstacles: GridPosition[] = [];
  for (let r = centerRow - halfH; r <= centerRow + halfH; r++) {
    for (let c = centerCol - halfW; c <= centerCol + halfW; c++) {
      const cr = clampRow(r);
      const cc = clampCol(c);
      obstacles.push({ row: cr, col: cc });
    }
  }

  return { obstacles: filterObstacles(obstacles, entryPoints, exitPoints), entryPoints, exitPoints };
}

function generateCorridors(rng: SeededRNG): LayoutResult {
  const entryPoints: GridPosition[] = [{ row: rng.intRange(3, 8), col: 0 }];
  const exitPoints: GridPosition[] = [{ row: rng.intRange(3, 8), col: 19 }];

  const possibleCols = [5, 6, 7, 8, 12, 13, 14, 15];
  const wallCount = rng.intRange(2, 3);

  // Pick distinct columns for walls
  const shuffled = [...possibleCols];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const wallCols = shuffled.slice(0, wallCount).sort((a, b) => a - b);

  const obstacles: GridPosition[] = [];

  for (const wCol of wallCols) {
    // Each wall spans row 1 to row 10, with 1-2 gaps of 2 cells
    const gapCount = rng.intRange(1, 2);
    const gapStarts: number[] = [];
    for (let g = 0; g < gapCount; g++) {
      gapStarts.push(rng.intRange(2, 8)); // gap rows: gapStart and gapStart+1
    }

    for (let r = 1; r <= 10; r++) {
      let inGap = false;
      for (const gs of gapStarts) {
        if (r >= gs && r <= gs + 1) {
          inGap = true;
          break;
        }
      }
      if (!inGap) {
        obstacles.push({ row: r, col: wCol });
      }
    }
  }

  return { obstacles: filterObstacles(obstacles, entryPoints, exitPoints), entryPoints, exitPoints };
}

function generateSplitPath(rng: SeededRNG): LayoutResult {
  const entryPoints: GridPosition[] = [
    { row: rng.intRange(1, 2), col: 0 },
    { row: rng.intRange(9, 10), col: 0 },
  ];
  const exitPoints: GridPosition[] = [{ row: rng.intRange(5, 6), col: 19 }];

  // Horizontal wall at rows 5-6, from col 2 to col 14, with 1-2 gaps
  const gapCount = rng.intRange(1, 2);
  const gapCols: number[] = [];
  for (let g = 0; g < gapCount; g++) {
    gapCols.push(rng.intRange(4, 12)); // gap at gapCol and gapCol+1
  }

  const obstacles: GridPosition[] = [];
  for (let c = 2; c <= 14; c++) {
    let inGap = false;
    for (const gc of gapCols) {
      if (c >= gc && c <= gc + 1) {
        inGap = true;
        break;
      }
    }
    if (!inGap) {
      obstacles.push({ row: 5, col: c });
      obstacles.push({ row: 6, col: c });
    }
  }

  return { obstacles: filterObstacles(obstacles, entryPoints, exitPoints), entryPoints, exitPoints };
}

function generateGauntlet(rng: SeededRNG): LayoutResult {
  const entryPoints: GridPosition[] = [{ row: rng.intRange(0, 1), col: 0 }];
  const exitPoints: GridPosition[] = [{ row: rng.intRange(10, 11), col: 19 }];

  const blockCount = rng.intRange(3, 4);
  const obstacles: GridPosition[] = [];

  for (let i = 0; i < blockCount; i++) {
    const baseCol = clampCol(3 + i * 4 + rng.intRange(-1, 1));
    const baseRow = clampRow(1 + i * 3 + rng.intRange(-1, 1));

    // Randomly choose 2x3 or 3x2
    const wide = rng.next() < 0.5;
    const bw = wide ? 3 : 2;
    const bh = wide ? 2 : 3;

    for (let r = baseRow; r < baseRow + bh; r++) {
      for (let c = baseCol; c < baseCol + bw; c++) {
        const cr = clampRow(r);
        const cc = clampCol(c);
        obstacles.push({ row: cr, col: cc });
      }
    }
  }

  return { obstacles: filterObstacles(obstacles, entryPoints, exitPoints), entryPoints, exitPoints };
}

function generateFortress(rng: SeededRNG): LayoutResult {
  const entryPoints: GridPosition[] = [{ row: rng.intRange(4, 5), col: 0 }];
  const exitPoints: GridPosition[] = [{ row: rng.intRange(5, 6), col: 19 }];

  // Ring outer dimensions: ~10 cols x 7 rows, centered
  const ringStartCol = 5;
  const ringEndCol = 14; // 10 cols wide
  const ringStartRow = 2;
  const ringEndRow = 8; // 7 rows tall

  const entryRow = entryPoints[0]!.row;
  const exitRow = exitPoints[0]!.row;

  const obstacles: GridPosition[] = [];

  // Top edge
  for (let c = ringStartCol; c <= ringEndCol; c++) {
    obstacles.push({ row: ringStartRow, col: c });
  }

  // Bottom edge
  for (let c = ringStartCol; c <= ringEndCol; c++) {
    obstacles.push({ row: ringEndRow, col: c });
  }

  // Left edge with 2-cell gap aligned with entry row
  for (let r = ringStartRow + 1; r < ringEndRow; r++) {
    if (r === entryRow || r === entryRow + 1) continue; // 2-cell gap
    obstacles.push({ row: r, col: ringStartCol });
  }

  // Right edge with 2-cell gap aligned with exit row
  for (let r = ringStartRow + 1; r < ringEndRow; r++) {
    if (r === exitRow || r === exitRow + 1) continue; // 2-cell gap
    obstacles.push({ row: r, col: ringEndCol });
  }

  // Optionally add 1-2 interior obstacles
  const interiorCount = rng.intRange(1, 2);
  for (let i = 0; i < interiorCount; i++) {
    const ir = rng.intRange(ringStartRow + 2, ringEndRow - 2);
    const ic = rng.intRange(ringStartCol + 2, ringEndCol - 2);
    obstacles.push({ row: ir, col: ic });
  }

  return { obstacles: filterObstacles(obstacles, entryPoints, exitPoints), entryPoints, exitPoints };
}

// ============ TEMPLATE REGISTRY ============

export const LAYOUT_TEMPLATES: Record<LayoutType, LayoutTemplate> = {
  open_field: {
    type: 'open_field',
    difficultyRating: 1,
    generate: generateOpenField,
  },
  island: {
    type: 'island',
    difficultyRating: 2,
    generate: generateIsland,
  },
  corridors: {
    type: 'corridors',
    difficultyRating: 2,
    generate: generateCorridors,
  },
  split_path: {
    type: 'split_path',
    difficultyRating: 3,
    generate: generateSplitPath,
  },
  gauntlet: {
    type: 'gauntlet',
    difficultyRating: 4,
    generate: generateGauntlet,
  },
  fortress: {
    type: 'fortress',
    difficultyRating: 5,
    generate: generateFortress,
  },
};
