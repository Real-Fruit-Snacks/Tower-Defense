import Phaser from 'phaser';
import { GRID, COLORS, GAME } from '../constants';
import type { GridPosition } from '../types';

export class GridRenderer {
  private scene: Phaser.Scene;
  private gridGraphics: Phaser.GameObjects.Graphics;
  private highlightGraphics: Phaser.GameObjects.Graphics;
  private pathGraphics: Phaser.GameObjects.Graphics;
  private scanLineGraphics: Phaser.GameObjects.Graphics;
  private entryExitGlowGraphics: Phaser.GameObjects.Graphics;
  private originX: number;
  private originY: number;

  // Animation state
  private scanLineY = 0;
  private pathDashOffset = 0;
  private pulsePhase = 0;
  private currentPathWaypoints: GridPosition[] = [];
  private entryWorldPos = { x: 0, y: 0 };
  private exitWorldPos = { x: 0, y: 0 };
  private entryWorldPositions: { x: number; y: number }[] = [];
  private exitWorldPositions: { x: number; y: number }[] = [];
  private obstacleGraphics: Phaser.GameObjects.Graphics;
  private gridWidth: number;
  private gridHeight: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const playAreaWidth = GAME.WIDTH;
    this.gridWidth = GRID.COLS * GRID.CELL_SIZE;
    this.gridHeight = GRID.ROWS * GRID.CELL_SIZE;
    this.originX = Math.floor((playAreaWidth - this.gridWidth) / 2);
    this.originY = GAME.HUD_HEIGHT + Math.floor(((GAME.HEIGHT - GAME.HUD_HEIGHT - GAME.TOWER_BAR_HEIGHT) - this.gridHeight) / 2);

    this.gridGraphics = scene.add.graphics().setDepth(0);
    this.highlightGraphics = scene.add.graphics().setDepth(1);
    this.pathGraphics = scene.add.graphics().setDepth(1);

    this.obstacleGraphics = scene.add.graphics().setDepth(0.2);
    this.scanLineGraphics = scene.add.graphics().setDepth(0.5);
    this.scanLineGraphics.setBlendMode(Phaser.BlendModes.ADD);

    this.entryExitGlowGraphics = scene.add.graphics().setDepth(0.3);
    this.entryExitGlowGraphics.setBlendMode(Phaser.BlendModes.ADD);
  }

  get gridOriginX(): number { return this.originX; }
  get gridOriginY(): number { return this.originY; }

  drawGrid(): void {
    this.gridGraphics.clear();

    // Grid border glow
    this.gridGraphics.lineStyle(1, COLORS.ACCENT_CYAN, 0.08);
    this.gridGraphics.strokeRect(this.originX - 1, this.originY - 1, this.gridWidth + 2, this.gridHeight + 2);

    // Grid lines — slightly more visible than before
    this.gridGraphics.lineStyle(0.5, COLORS.GRID_LINE, 0.10);

    for (let c = 0; c <= GRID.COLS; c++) {
      const x = this.originX + c * GRID.CELL_SIZE;
      this.gridGraphics.lineBetween(x, this.originY, x, this.originY + this.gridHeight);
    }
    for (let r = 0; r <= GRID.ROWS; r++) {
      const y = this.originY + r * GRID.CELL_SIZE;
      this.gridGraphics.lineBetween(this.originX, y, this.originX + this.gridWidth, y);
    }

    // Intersection node dots — subtle circuit-board feel
    this.gridGraphics.fillStyle(COLORS.ACCENT_CYAN, 0.06);
    for (let c = 0; c <= GRID.COLS; c += 2) {
      for (let r = 0; r <= GRID.ROWS; r += 2) {
        this.gridGraphics.fillCircle(
          this.originX + c * GRID.CELL_SIZE,
          this.originY + r * GRID.CELL_SIZE,
          1.5,
        );
      }
    }
  }

  drawEntryExit(entries: GridPosition[], exits: GridPosition[]): void {
    this.entryWorldPositions = [];
    this.exitWorldPositions = [];

    // Entry markers (green arrows)
    for (const entry of entries) {
      const ex = this.originX + entry.col * GRID.CELL_SIZE;
      const ey = this.originY + entry.row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
      this.gridGraphics.fillStyle(0x4ade80, 0.7);
      this.gridGraphics.fillTriangle(ex - 8, ey - 14, ex + 14, ey, ex - 8, ey + 14);
      this.entryWorldPositions.push({ x: ex + 3, y: ey });
    }

    // Exit markers (red arrows)
    for (const exit of exits) {
      const xx = this.originX + (exit.col + 1) * GRID.CELL_SIZE;
      const xy = this.originY + exit.row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
      this.gridGraphics.fillStyle(COLORS.DANGER, 0.7);
      this.gridGraphics.fillTriangle(xx - 14, xy - 14, xx + 8, xy, xx - 14, xy + 14);
      this.exitWorldPositions.push({ x: xx - 3, y: xy });
    }

    // Backward compat
    this.entryWorldPos = this.entryWorldPositions[0] ?? { x: 0, y: 0 };
    this.exitWorldPos = this.exitWorldPositions[0] ?? { x: 0, y: 0 };
  }

  /** Draw obstacle cells with neon blocked appearance */
  drawObstacles(obstacles: GridPosition[]): void {
    this.obstacleGraphics.clear();
    for (const pos of obstacles) {
      const x = this.originX + pos.col * GRID.CELL_SIZE;
      const y = this.originY + pos.row * GRID.CELL_SIZE;
      // Dark fill
      this.obstacleGraphics.fillStyle(0x1a1a2e, 0.8);
      this.obstacleGraphics.fillRect(x + 1, y + 1, GRID.CELL_SIZE - 2, GRID.CELL_SIZE - 2);
      // Neon border
      this.obstacleGraphics.lineStyle(1, COLORS.DANGER, 0.25);
      this.obstacleGraphics.strokeRect(x + 1, y + 1, GRID.CELL_SIZE - 2, GRID.CELL_SIZE - 2);
      // Inner X pattern
      this.obstacleGraphics.lineStyle(0.5, COLORS.DANGER, 0.12);
      this.obstacleGraphics.lineBetween(x + 6, y + 6, x + GRID.CELL_SIZE - 6, y + GRID.CELL_SIZE - 6);
      this.obstacleGraphics.lineBetween(x + GRID.CELL_SIZE - 6, y + 6, x + 6, y + GRID.CELL_SIZE - 6);
    }
  }

  /** Call each frame for animated grid effects */
  update(_time: number, delta: number): void {
    // Scan line sweep
    this.scanLineY += (this.gridHeight / 4000) * delta;
    if (this.scanLineY > this.gridHeight) this.scanLineY = 0;

    this.scanLineGraphics.clear();
    const scanY = this.originY + this.scanLineY;
    this.scanLineGraphics.lineStyle(1.5, COLORS.ACCENT_CYAN, 0.10);
    this.scanLineGraphics.lineBetween(this.originX, scanY, this.originX + this.gridWidth, scanY);
    // Fade tail
    this.scanLineGraphics.lineStyle(1, COLORS.ACCENT_CYAN, 0.04);
    this.scanLineGraphics.lineBetween(this.originX, scanY + 3, this.originX + this.gridWidth, scanY + 3);
    this.scanLineGraphics.lineStyle(0.5, COLORS.ACCENT_CYAN, 0.02);
    this.scanLineGraphics.lineBetween(this.originX, scanY + 6, this.originX + this.gridWidth, scanY + 6);

    // Marching ants path
    this.pathDashOffset += delta * 0.04;
    this.drawAnimatedPath();

    // Entry/exit pulsing glow (supports multiple points)
    this.pulsePhase += delta * 0.003;
    this.entryExitGlowGraphics.clear();

    for (let i = 0; i < this.entryWorldPositions.length; i++) {
      const pos = this.entryWorldPositions[i]!;
      const r = 22 + Math.sin(this.pulsePhase + i) * 6;
      const a = 0.06 + Math.sin(this.pulsePhase + i) * 0.03;
      this.entryExitGlowGraphics.fillStyle(0x4ade80, a);
      this.entryExitGlowGraphics.fillCircle(pos.x, pos.y, r);
    }

    for (let i = 0; i < this.exitWorldPositions.length; i++) {
      const pos = this.exitWorldPositions[i]!;
      const r = 22 + Math.sin(this.pulsePhase + i + 1) * 6;
      const a = 0.06 + Math.sin(this.pulsePhase + i + 1) * 0.03;
      this.entryExitGlowGraphics.fillStyle(COLORS.DANGER, a);
      this.entryExitGlowGraphics.fillCircle(pos.x, pos.y, r);
    }
  }

  private drawAnimatedPath(): void {
    this.pathGraphics.clear();
    if (this.currentPathWaypoints.length < 2) return;

    const dashLen = 12;
    const gapLen = 8;
    const totalSegment = dashLen + gapLen;

    this.pathGraphics.lineStyle(2, COLORS.PATH, 0.22);

    let totalDist = 0;
    for (let i = 1; i < this.currentPathWaypoints.length; i++) {
      const prev = this.currentPathWaypoints[i - 1]!;
      const curr = this.currentPathWaypoints[i]!;
      const px = this.originX + prev.col * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
      const py = this.originY + prev.row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
      const cx = this.originX + curr.col * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
      const cy = this.originY + curr.row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;

      const dx = cx - px;
      const dy = cy - py;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen === 0) continue;

      const ux = dx / segLen;
      const uy = dy / segLen;

      let d = 0;
      while (d < segLen) {
        const patternPos = (totalDist + d + this.pathDashOffset) % totalSegment;
        if (patternPos < dashLen) {
          const remaining = Math.min(dashLen - patternPos, segLen - d);
          const startX = px + ux * d;
          const startY = py + uy * d;
          const endX = px + ux * Math.min(d + remaining, segLen);
          const endY = py + uy * Math.min(d + remaining, segLen);
          this.pathGraphics.lineBetween(startX, startY, endX, endY);
          d += remaining;
        } else {
          d += totalSegment - patternPos;
        }
      }
      totalDist += segLen;
    }
  }

  highlightCell(row: number, col: number, color: number, alpha = 0.25): void {
    this.highlightGraphics.clear();
    const x = this.originX + col * GRID.CELL_SIZE;
    const y = this.originY + row * GRID.CELL_SIZE;

    // Fill
    this.highlightGraphics.fillStyle(color, alpha);
    this.highlightGraphics.fillRect(x, y, GRID.CELL_SIZE, GRID.CELL_SIZE);

    // Glow border
    this.highlightGraphics.lineStyle(1.5, color, 0.4);
    this.highlightGraphics.strokeRect(x + 1, y + 1, GRID.CELL_SIZE - 2, GRID.CELL_SIZE - 2);
  }

  clearHighlight(): void {
    this.highlightGraphics.clear();
  }

  drawRangeCircle(row: number, col: number, range: number, color: number): void {
    const cx = this.originX + col * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
    const cy = this.originY + row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
    const radius = range * GRID.CELL_SIZE;

    // Outer faint ring
    this.highlightGraphics.lineStyle(1, color, 0.15);
    this.highlightGraphics.strokeCircle(cx, cy, radius);
    // Inner brighter ring
    this.highlightGraphics.lineStyle(0.5, color, 0.25);
    this.highlightGraphics.strokeCircle(cx, cy, radius - 2);
  }

  drawPath(waypoints: GridPosition[]): void {
    this.currentPathWaypoints = waypoints;
    // Initial draw handled by update() animation loop
  }

  worldToGrid(worldX: number, worldY: number): GridPosition | null {
    const col = Math.floor((worldX - this.originX) / GRID.CELL_SIZE);
    const row = Math.floor((worldY - this.originY) / GRID.CELL_SIZE);
    if (row < 0 || row >= GRID.ROWS || col < 0 || col >= GRID.COLS) return null;
    return { row, col };
  }

  gridToWorld(row: number, col: number): { x: number; y: number } {
    return {
      x: this.originX + col * GRID.CELL_SIZE + GRID.CELL_SIZE / 2,
      y: this.originY + row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2,
    };
  }

  destroy(): void {
    this.gridGraphics.destroy();
    this.highlightGraphics.destroy();
    this.pathGraphics.destroy();
    this.obstacleGraphics.destroy();
    this.scanLineGraphics.destroy();
    this.entryExitGlowGraphics.destroy();
  }
}
