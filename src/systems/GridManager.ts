import { GRID } from '../constants';
import type { GridCell, GridPosition, LevelConfig } from '../types';

export class GridManager {
  private grid: GridCell[][] = [];

  /** Primary entry/exit (backward compatible) */
  readonly entry: GridPosition;
  readonly exit: GridPosition;

  /** All entry/exit points (for multi-entry layouts) */
  readonly entries: GridPosition[];
  readonly exits: GridPosition[];
  readonly obstacles: GridPosition[];

  constructor(levelConfig?: LevelConfig) {
    if (levelConfig) {
      this.entries = levelConfig.entryPoints;
      this.exits = levelConfig.exitPoints;
      this.obstacles = levelConfig.gridObstacles;
    } else {
      this.entries = [{ row: Math.floor(GRID.ROWS / 2), col: 0 }];
      this.exits = [{ row: Math.floor(GRID.ROWS / 2), col: GRID.COLS - 1 }];
      this.obstacles = [];
    }

    this.entry = this.entries[0]!;
    this.exit = this.exits[0]!;
    this.initGrid();
  }

  private initGrid(): void {
    // Build a fast lookup set for obstacles
    const obstacleSet = new Set(this.obstacles.map(o => `${o.row},${o.col}`));
    const entrySet = new Set(this.entries.map(e => `${e.row},${e.col}`));
    const exitSet = new Set(this.exits.map(e => `${e.row},${e.col}`));

    this.grid = [];
    for (let row = 0; row < GRID.ROWS; row++) {
      const gridRow: GridCell[] = [];
      for (let col = 0; col < GRID.COLS; col++) {
        const key = `${row},${col}`;
        const isObs = obstacleSet.has(key);
        gridRow.push({
          row,
          col,
          occupied: isObs, // obstacles start as occupied
          towerId: null,
          isObstacle: isObs,
          isEntry: entrySet.has(key),
          isExit: exitSet.has(key),
        });
      }
      this.grid.push(gridRow);
    }
  }

  getCell(row: number, col: number): GridCell | null {
    if (row < 0 || row >= GRID.ROWS || col < 0 || col >= GRID.COLS) return null;
    return this.grid[row]![col]!;
  }

  isCellBuildable(row: number, col: number): boolean {
    const cell = this.getCell(row, col);
    if (!cell) return false;
    return !cell.occupied && !cell.isEntry && !cell.isExit && !cell.isObstacle;
  }

  placeOnCell(row: number, col: number, towerId: string): boolean {
    const cell = this.getCell(row, col);
    if (!cell || !this.isCellBuildable(row, col)) return false;
    cell.occupied = true;
    cell.towerId = towerId;
    return true;
  }

  removeFromCell(row: number, col: number): void {
    const cell = this.getCell(row, col);
    if (cell && !cell.isObstacle) {
      cell.occupied = false;
      cell.towerId = null;
    }
  }

  isCellOccupied(row: number, col: number): boolean {
    const cell = this.getCell(row, col);
    return cell ? cell.occupied : true;
  }

  getWalkableGrid(): boolean[][] {
    return this.grid.map(row =>
      row.map(cell => !cell.occupied),
    );
  }

  testPlacement(row: number, col: number): boolean[][] {
    const walkable = this.getWalkableGrid();
    if (walkable[row]?.[col] !== undefined) {
      walkable[row]![col] = false;
    }
    return walkable;
  }

  reset(): void {
    this.initGrid();
  }
}
