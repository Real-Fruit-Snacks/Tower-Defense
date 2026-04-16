import { GRID } from '../constants';
import type { GridPosition } from '../types';
import { PriorityQueue } from '../utils/PriorityQueue';
import { manhattanDistance } from '../utils/MathUtils';
import { GridManager } from './GridManager';

const DIRECTIONS: GridPosition[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export class PathfindingManager {
  private gridManager: GridManager;
  /** Cached paths keyed by "entryIdx-exitIdx" */
  private cachedPaths: Map<string, GridPosition[]> = new Map();

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
    this.recalculateAllPaths();
  }

  /** A* pathfinding on a walkable grid */
  findPath(
    start: GridPosition,
    end: GridPosition,
    walkable: boolean[][],
  ): GridPosition[] | null {
    const key = (r: number, c: number) => `${r},${c}`;

    const openSet = new PriorityQueue<GridPosition>();
    const cameFrom = new Map<string, GridPosition>();
    const gScore = new Map<string, number>();

    const startKey = key(start.row, start.col);
    gScore.set(startKey, 0);
    openSet.insert(start, manhattanDistance(start.row, start.col, end.row, end.col));

    while (!openSet.isEmpty()) {
      const current = openSet.extractMin()!;
      const currentKey = key(current.row, current.col);

      if (current.row === end.row && current.col === end.col) {
        const path: GridPosition[] = [current];
        let traceKey = currentKey;
        while (cameFrom.has(traceKey)) {
          const prev = cameFrom.get(traceKey)!;
          path.unshift(prev);
          traceKey = key(prev.row, prev.col);
        }
        return path;
      }

      const currentG = gScore.get(currentKey) ?? Infinity;

      for (const dir of DIRECTIONS) {
        const nr = current.row + dir.row;
        const nc = current.col + dir.col;

        if (nr < 0 || nr >= GRID.ROWS || nc < 0 || nc >= GRID.COLS) continue;
        if (!walkable[nr]?.[nc]) continue;

        const neighborKey = key(nr, nc);
        const tentativeG = currentG + 1;
        const prevG = gScore.get(neighborKey) ?? Infinity;

        if (tentativeG < prevG) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + manhattanDistance(nr, nc, end.row, end.col);
          openSet.insert({ row: nr, col: nc }, f);
        }
      }
    }

    return null;
  }

  /** Recalculate paths for ALL entry/exit combinations */
  recalculateAllPaths(): boolean {
    this.cachedPaths.clear();
    const walkable = this.gridManager.getWalkableGrid();
    let allValid = true;

    for (let ei = 0; ei < this.gridManager.entries.length; ei++) {
      for (let xi = 0; xi < this.gridManager.exits.length; xi++) {
        const entry = this.gridManager.entries[ei]!;
        const exit = this.gridManager.exits[xi]!;
        const path = this.findPath(entry, exit, walkable);
        if (path) {
          this.cachedPaths.set(`${ei}-${xi}`, path);
        } else {
          allValid = false;
        }
      }
    }

    return allValid;
  }

  /** Recalculate (backward compatible, returns primary path) */
  recalculatePath(): GridPosition[] | null {
    this.recalculateAllPaths();
    return this.getPath();
  }

  /** Test if placing a tower at (row, col) would still allow ALL valid paths */
  isPathValidWithPlacement(row: number, col: number): boolean {
    const walkable = this.gridManager.testPlacement(row, col);
    for (let ei = 0; ei < this.gridManager.entries.length; ei++) {
      for (let xi = 0; xi < this.gridManager.exits.length; xi++) {
        const entry = this.gridManager.entries[ei]!;
        const exit = this.gridManager.exits[xi]!;
        const path = this.findPath(entry, exit, walkable);
        if (!path) return false;
      }
    }
    return true;
  }

  /** Get primary cached path (entry 0 → exit 0) — backward compatible */
  getPath(): GridPosition[] {
    return this.cachedPaths.get('0-0') ?? [];
  }

  /** Get path from a specific entry index to exit 0 */
  getPathForEntry(entryIndex: number, exitIndex = 0): GridPosition[] {
    return this.cachedPaths.get(`${entryIndex}-${exitIndex}`) ?? this.getPath();
  }

  /** Get all cached paths */
  getAllPaths(): Map<string, GridPosition[]> {
    return this.cachedPaths;
  }
}
