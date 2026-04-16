import Phaser from 'phaser';
import { GRID, COLORS, GAME } from '../constants';
import type { GridPosition } from '../types';

/**
 * The playfield renderer. Draws the grid, the animated path, obstacles,
 * entry/exit portals, range preview circles, and cell highlights.
 *
 * Visual layers (depth, low → high):
 *  -0.5 baseFillGraphics  — play-area tile background (solid dark panel)
 *   0.0 gridGraphics      — minor + major gridlines + intersection dots
 *   0.1 frameGraphics     — outer neon frame + corner brackets (ADD blend)
 *   0.2 obstacleGraphics  — blocked cells (raised-panel look)
 *   0.3 portalGraphics    — entry/exit rings + chevrons + labels (ADD)
 *   0.5 scanLineGraphics  — sweeping scan line (ADD blend)
 *   1.0 pathGraphics      — path halo + core + flowing arrows
 *   1.5 highlightGraphics — hover cell + range circle
 */
export class GridRenderer {
  private scene: Phaser.Scene;
  // Static-ish layers
  private baseFillGraphics: Phaser.GameObjects.Graphics;
  private gridGraphics: Phaser.GameObjects.Graphics;
  private frameGraphics: Phaser.GameObjects.Graphics;
  private obstacleGraphics: Phaser.GameObjects.Graphics;
  // Animated layers
  private scanLineGraphics: Phaser.GameObjects.Graphics;
  private portalGraphics: Phaser.GameObjects.Graphics;
  private pathGraphics: Phaser.GameObjects.Graphics;
  private highlightGraphics: Phaser.GameObjects.Graphics;

  private originX: number;
  private originY: number;
  private gridWidth: number;
  private gridHeight: number;

  // Animation state
  private scanLineY = 0;
  private pathFlowOffset = 0;
  private portalPhase = 0;
  private framePhase = 0;
  private currentPathWaypoints: GridPosition[] = [];
  private entryWorldPositions: { x: number; y: number }[] = [];
  private exitWorldPositions: { x: number; y: number }[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const playAreaWidth = GAME.WIDTH;
    this.gridWidth = GRID.COLS * GRID.CELL_SIZE;
    this.gridHeight = GRID.ROWS * GRID.CELL_SIZE;
    this.originX = Math.floor((playAreaWidth - this.gridWidth) / 2);
    this.originY = GAME.HUD_HEIGHT
      + Math.floor(((GAME.HEIGHT - GAME.HUD_HEIGHT - GAME.TOWER_BAR_HEIGHT) - this.gridHeight) / 2);

    this.baseFillGraphics = scene.add.graphics().setDepth(-0.5);
    this.gridGraphics = scene.add.graphics().setDepth(0);
    this.frameGraphics = scene.add.graphics().setDepth(0.1);
    this.frameGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.obstacleGraphics = scene.add.graphics().setDepth(0.2);
    this.portalGraphics = scene.add.graphics().setDepth(0.3);
    this.portalGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.scanLineGraphics = scene.add.graphics().setDepth(0.5);
    this.scanLineGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.pathGraphics = scene.add.graphics().setDepth(1);
    this.highlightGraphics = scene.add.graphics().setDepth(1.5);
  }

  get gridOriginX(): number { return this.originX; }
  get gridOriginY(): number { return this.originY; }

  /**
   * Draw the static grid layers: base fill, minor/major lines, intersection
   * dots, outer frame. Only called once on setup; the animated frame
   * accents are redrawn in update().
   */
  drawGrid(): void {
    const gx = this.originX;
    const gy = this.originY;
    const gw = this.gridWidth;
    const gh = this.gridHeight;

    // ─── Base panel fill — gives the playfield a distinct "surface" ───
    this.baseFillGraphics.clear();
    // Slight vertical gradient for depth
    this.baseFillGraphics.fillGradientStyle(
      0x0a0a18, 0x0a0a18, 0x050510, 0x050510,
      1, 1, 1, 1,
    );
    this.baseFillGraphics.fillRect(gx, gy, gw, gh);
    // Subtle inner vignette (darker toward the rim)
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const alpha = 0.06 * (1 - t);
      const inset = (1 - t) * 8;
      this.baseFillGraphics.fillStyle(0x000000, alpha);
      this.baseFillGraphics.fillRect(gx + inset, gy + inset, gw - inset * 2, gh - inset * 2);
    }

    // ─── Grid lines ───
    this.gridGraphics.clear();

    // Minor gridlines — every cell, very faint
    this.gridGraphics.lineStyle(1, COLORS.ACCENT_CYAN, 0.05);
    for (let c = 1; c < GRID.COLS; c++) {
      const x = gx + c * GRID.CELL_SIZE;
      this.gridGraphics.lineBetween(x, gy, x, gy + gh);
    }
    for (let r = 1; r < GRID.ROWS; r++) {
      const y = gy + r * GRID.CELL_SIZE;
      this.gridGraphics.lineBetween(gx, y, gx + gw, y);
    }

    // Major gridlines — every 4 cells, stronger
    this.gridGraphics.lineStyle(1, COLORS.ACCENT_CYAN, 0.15);
    for (let c = 4; c < GRID.COLS; c += 4) {
      const x = gx + c * GRID.CELL_SIZE;
      this.gridGraphics.lineBetween(x, gy, x, gy + gh);
    }
    for (let r = 4; r < GRID.ROWS; r += 4) {
      const y = gy + r * GRID.CELL_SIZE;
      this.gridGraphics.lineBetween(gx, y, gx + gw, y);
    }

    // Intersection dots at every major crossing — circuit-board feel
    for (let c = 0; c <= GRID.COLS; c += 4) {
      for (let r = 0; r <= GRID.ROWS; r += 4) {
        const x = gx + c * GRID.CELL_SIZE;
        const y = gy + r * GRID.CELL_SIZE;
        this.gridGraphics.fillStyle(COLORS.ACCENT_CYAN, 0.5);
        this.gridGraphics.fillCircle(x, y, 1.5);
        this.gridGraphics.fillStyle(COLORS.ACCENT_CYAN, 0.15);
        this.gridGraphics.fillCircle(x, y, 3);
      }
    }

    // Minor intersection dots — every 2 cells, tiny
    this.gridGraphics.fillStyle(COLORS.ACCENT_CYAN, 0.12);
    for (let c = 0; c <= GRID.COLS; c += 2) {
      for (let r = 0; r <= GRID.ROWS; r += 2) {
        if (c % 4 === 0 && r % 4 === 0) continue;
        this.gridGraphics.fillCircle(gx + c * GRID.CELL_SIZE, gy + r * GRID.CELL_SIZE, 1);
      }
    }
  }

  drawEntryExit(entries: GridPosition[], exits: GridPosition[]): void {
    this.entryWorldPositions = [];
    this.exitWorldPositions = [];

    for (const entry of entries) {
      const ex = this.originX + entry.col * GRID.CELL_SIZE;
      const ey = this.originY + entry.row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
      this.entryWorldPositions.push({ x: ex, y: ey });
    }
    for (const exit of exits) {
      const xx = this.originX + (exit.col + 1) * GRID.CELL_SIZE;
      const xy = this.originY + exit.row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
      this.exitWorldPositions.push({ x: xx, y: xy });
    }
  }

  /**
   * Draw obstacle cells as raised neon blocks with:
   *   • outer drop-shadow glow
   *   • gradient panel fill
   *   • top highlight strip for that "raised" feel
   *   • diagonal hazard stripes
   *   • pulsing border (updated in the update loop)
   */
  drawObstacles(obstacles: GridPosition[]): void {
    this.obstacleGraphics.clear();
    for (const pos of obstacles) {
      const x = this.originX + pos.col * GRID.CELL_SIZE;
      const y = this.originY + pos.row * GRID.CELL_SIZE;
      const s = GRID.CELL_SIZE;

      // Outer glow / shadow (slightly wider than cell)
      this.obstacleGraphics.fillStyle(COLORS.DANGER, 0.05);
      this.obstacleGraphics.fillRect(x - 2, y - 2, s + 4, s + 4);

      // Panel fill (gradient for depth)
      this.obstacleGraphics.fillGradientStyle(
        0x261420, 0x261420, 0x180b15, 0x180b15,
        0.95, 0.95, 0.95, 0.95,
      );
      this.obstacleGraphics.fillRect(x + 1, y + 1, s - 2, s - 2);

      // Top highlight strip — "raised panel" effect
      this.obstacleGraphics.fillStyle(COLORS.DANGER, 0.28);
      this.obstacleGraphics.fillRect(x + 2, y + 2, s - 4, 2);

      // Diagonal hazard stripes (subtle)
      for (let d = -s; d < s; d += 8) {
        const x1 = x + Math.max(0, d);
        const y1 = y + Math.max(0, -d);
        const x2 = x + Math.min(s, d + s);
        const y2 = y + Math.min(s, s - d);
        this.obstacleGraphics.lineStyle(1, COLORS.DANGER, 0.08);
        this.obstacleGraphics.lineBetween(x1, y1, x2, y2);
      }

      // Crisp border
      this.obstacleGraphics.lineStyle(1.2, COLORS.DANGER, 0.55);
      this.obstacleGraphics.strokeRect(x + 1, y + 1, s - 2, s - 2);
      // Inner thin highlight
      this.obstacleGraphics.lineStyle(0.5, 0xffffff, 0.08);
      this.obstacleGraphics.strokeRect(x + 3, y + 3, s - 6, s - 6);

      // Corner ticks
      const t = 4;
      this.obstacleGraphics.lineStyle(1.2, COLORS.DANGER, 0.8);
      // TL
      this.obstacleGraphics.lineBetween(x + 1, y + 1 + t, x + 1, y + 1);
      this.obstacleGraphics.lineBetween(x + 1, y + 1, x + 1 + t, y + 1);
      // TR
      this.obstacleGraphics.lineBetween(x + s - 1 - t, y + 1, x + s - 1, y + 1);
      this.obstacleGraphics.lineBetween(x + s - 1, y + 1, x + s - 1, y + 1 + t);
      // BL
      this.obstacleGraphics.lineBetween(x + 1, y + s - 1 - t, x + 1, y + s - 1);
      this.obstacleGraphics.lineBetween(x + 1, y + s - 1, x + 1 + t, y + s - 1);
      // BR
      this.obstacleGraphics.lineBetween(x + s - 1 - t, y + s - 1, x + s - 1, y + s - 1);
      this.obstacleGraphics.lineBetween(x + s - 1, y + s - 1, x + s - 1, y + s - 1 - t);
    }
  }

  /** Update loop — animated layers (frame pulse, scan line, path flow, portals). */
  update(_time: number, delta: number): void {
    this.framePhase += delta * 0.001;
    this.scanLineY += (this.gridHeight / 4500) * delta;
    if (this.scanLineY > this.gridHeight) this.scanLineY = 0;
    this.pathFlowOffset += delta * 0.06;
    this.portalPhase += delta * 0.004;

    this.drawFrame();
    this.drawScanLine();
    this.drawAnimatedPath();
    this.drawPortals();
  }

  /**
   * Outer neon frame with pulsing brightness + corner brackets. Feels
   * like the playfield is a holographic display, not just lines on a
   * grid.
   */
  private drawFrame(): void {
    this.frameGraphics.clear();
    const gx = this.originX;
    const gy = this.originY;
    const gw = this.gridWidth;
    const gh = this.gridHeight;
    const pulse = 0.5 + Math.sin(this.framePhase) * 0.5;

    // Outer glow halo
    for (let i = 3; i >= 1; i--) {
      const alpha = 0.04 * (i / 3) * (0.7 + pulse * 0.3);
      this.frameGraphics.lineStyle(i * 2, COLORS.ACCENT_CYAN, alpha);
      this.frameGraphics.strokeRect(gx - i, gy - i, gw + i * 2, gh + i * 2);
    }
    // Inner crisp frame
    this.frameGraphics.lineStyle(1, COLORS.ACCENT_CYAN, 0.35 + pulse * 0.15);
    this.frameGraphics.strokeRect(gx, gy, gw, gh);
    // Inner shadow line (thin darker line just inside)
    this.frameGraphics.lineStyle(1, 0x000000, 0.4);
    this.frameGraphics.strokeRect(gx + 2, gy + 2, gw - 4, gh - 4);

    // Corner brackets — holographic targeting look
    const armLen = 22;
    const armW = 2;
    const cornerColor = COLORS.ACCENT_CYAN;
    const cornerAlpha = 0.8 + pulse * 0.2;
    this.frameGraphics.lineStyle(armW, cornerColor, cornerAlpha);

    // TL corner
    this.frameGraphics.lineBetween(gx - 3, gy - 3, gx - 3 + armLen, gy - 3);
    this.frameGraphics.lineBetween(gx - 3, gy - 3, gx - 3, gy - 3 + armLen);
    // TR
    this.frameGraphics.lineBetween(gx + gw + 3, gy - 3, gx + gw + 3 - armLen, gy - 3);
    this.frameGraphics.lineBetween(gx + gw + 3, gy - 3, gx + gw + 3, gy - 3 + armLen);
    // BL
    this.frameGraphics.lineBetween(gx - 3, gy + gh + 3, gx - 3 + armLen, gy + gh + 3);
    this.frameGraphics.lineBetween(gx - 3, gy + gh + 3, gx - 3, gy + gh + 3 - armLen);
    // BR
    this.frameGraphics.lineBetween(gx + gw + 3, gy + gh + 3, gx + gw + 3 - armLen, gy + gh + 3);
    this.frameGraphics.lineBetween(gx + gw + 3, gy + gh + 3, gx + gw + 3, gy + gh + 3 - armLen);

    // Corner dots
    this.frameGraphics.fillStyle(cornerColor, cornerAlpha);
    this.frameGraphics.fillCircle(gx - 3, gy - 3, 2.5);
    this.frameGraphics.fillCircle(gx + gw + 3, gy - 3, 2.5);
    this.frameGraphics.fillCircle(gx - 3, gy + gh + 3, 2.5);
    this.frameGraphics.fillCircle(gx + gw + 3, gy + gh + 3, 2.5);
  }

  private drawScanLine(): void {
    this.scanLineGraphics.clear();
    const scanY = this.originY + this.scanLineY;
    // Main sweep line
    this.scanLineGraphics.lineStyle(1.5, COLORS.ACCENT_CYAN, 0.12);
    this.scanLineGraphics.lineBetween(this.originX, scanY, this.originX + this.gridWidth, scanY);
    // Trailing fade
    for (let i = 1; i <= 3; i++) {
      this.scanLineGraphics.lineStyle(1, COLORS.ACCENT_CYAN, 0.05 / i);
      this.scanLineGraphics.lineBetween(
        this.originX, scanY + i * 3,
        this.originX + this.gridWidth, scanY + i * 3,
      );
    }
  }

  /**
   * Entry = "SPAWN GATE" — industrial bunker-door look with inner
   * containment field and forward chevron.
   * Exit  = "CORE"       — hexagonal target/objective with crosshairs.
   *
   * Both are thematic and mostly static. A very gentle border pulse
   * (breathe < 10% alpha swing) hints at "this is alive" without being
   * distracting. No expanding ring strobes, no white core flash.
   */
  private drawPortals(): void {
    this.portalGraphics.clear();
    const pulse = Math.sin(this.portalPhase * 0.8) * 0.5 + 0.5; // 0..1, slow

    for (const pos of this.entryWorldPositions) {
      this.drawEntryGate(pos.x, pos.y, pulse);
    }
    for (const pos of this.exitWorldPositions) {
      this.drawExitCore(pos.x, pos.y, pulse);
    }
  }

  private drawEntryGate(x: number, y: number, pulse: number): void {
    const g = this.portalGraphics;
    const color = 0x4ade80; // green

    // Soft halo
    g.fillStyle(color, 0.06 + pulse * 0.02);
    g.fillCircle(x + 2, y, 22);
    g.fillStyle(color, 0.1);
    g.fillCircle(x + 2, y, 14);

    // Gate panel — rounded rect extending left of the grid cell
    const w = 22;
    const h = 28;
    const gx = x - w + 2;
    const gy = y - h / 2;
    // Dark panel
    g.fillStyle(0x0a1810, 0.85);
    g.fillRoundedRect(gx, gy, w, h, 3);
    // Outer border
    g.lineStyle(1.5, color, 0.7 + pulse * 0.2);
    g.strokeRoundedRect(gx, gy, w, h, 3);
    // Inner highlight
    g.lineStyle(0.5, color, 0.25);
    g.strokeRoundedRect(gx + 2, gy + 2, w - 4, h - 4, 2);

    // Corner rivets (small dots)
    g.fillStyle(color, 0.8);
    g.fillCircle(gx + 3, gy + 3, 1);
    g.fillCircle(gx + w - 3, gy + 3, 1);
    g.fillCircle(gx + 3, gy + h - 3, 1);
    g.fillCircle(gx + w - 3, gy + h - 3, 1);

    // Inner "containment" diagonal lines
    g.lineStyle(0.5, color, 0.2);
    g.lineBetween(gx + 4, gy + 6, gx + w - 4, gy + 6);
    g.lineBetween(gx + 4, gy + h - 6, gx + w - 4, gy + h - 6);

    // Forward chevron, slightly brighter (points toward the path, i.e. right)
    const cx = x - 4;
    g.fillStyle(color, 0.95);
    g.fillTriangle(cx + 5, y, cx - 2, y - 4, cx - 2, y + 4);
    // Stacked fainter chevrons behind, suggest motion
    g.fillStyle(color, 0.4);
    g.fillTriangle(cx - 1, y, cx - 8, y - 4, cx - 8, y + 4);
  }

  private drawExitCore(x: number, y: number, pulse: number): void {
    const g = this.portalGraphics;
    const color = COLORS.DANGER; // red

    // Soft warning halo
    g.fillStyle(color, 0.06 + pulse * 0.02);
    g.fillCircle(x - 2, y, 24);
    g.fillStyle(color, 0.1);
    g.fillCircle(x - 2, y, 15);

    // Outer hexagon
    const rOuter = 13;
    const cxOuter = x - 2;
    const hexOuter: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      hexOuter.push(new Phaser.Geom.Point(cxOuter + Math.cos(a) * rOuter, y + Math.sin(a) * rOuter));
    }
    g.fillStyle(0x18080c, 0.85);
    g.fillPoints(hexOuter, true);
    g.lineStyle(1.5, color, 0.75 + pulse * 0.2);
    g.strokePoints(hexOuter, true);

    // Inner hexagon
    const rInner = 7;
    const hexInner: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      hexInner.push(new Phaser.Geom.Point(cxOuter + Math.cos(a) * rInner, y + Math.sin(a) * rInner));
    }
    g.lineStyle(1, color, 0.6);
    g.strokePoints(hexInner, true);

    // Crosshair ticks — short segments at cardinal directions on outer hex
    const tickLen = 5;
    g.lineStyle(1.5, color, 0.85);
    g.lineBetween(cxOuter, y - rOuter - 1, cxOuter, y - rOuter - 1 - tickLen);
    g.lineBetween(cxOuter, y + rOuter + 1, cxOuter, y + rOuter + 1 + tickLen);
    g.lineBetween(cxOuter - rOuter - 1, y, cxOuter - rOuter - 1 - tickLen, y);
    g.lineBetween(cxOuter + rOuter + 1, y, cxOuter + rOuter + 1 + tickLen, y);

    // Central marker — small red diamond on a dark bead
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(cxOuter, y, 3);
    g.fillStyle(color, 0.95);
    g.fillTriangle(cxOuter, y - 3, cxOuter + 3, y, cxOuter, y + 3);
    g.fillTriangle(cxOuter, y - 3, cxOuter - 3, y, cxOuter, y + 3);
  }

  private drawAnimatedPath(): void {
    this.pathGraphics.clear();
    if (this.currentPathWaypoints.length < 2) return;

    const gx = this.originX;
    const gy = this.originY;
    const half = GRID.CELL_SIZE / 2;
    const toWorld = (wp: GridPosition): { x: number; y: number } => ({
      x: gx + wp.col * GRID.CELL_SIZE + half,
      y: gy + wp.row * GRID.CELL_SIZE + half,
    });

    // Layer 1 — wide soft halo
    this.pathGraphics.lineStyle(14, COLORS.GOLD, 0.04);
    this.strokePathPolyline(toWorld);
    this.pathGraphics.lineStyle(8, COLORS.GOLD, 0.08);
    this.strokePathPolyline(toWorld);

    // Layer 2 — solid base line
    this.pathGraphics.lineStyle(4, COLORS.GOLD, 0.18);
    this.strokePathPolyline(toWorld);

    // Layer 3 — crisp center line
    this.pathGraphics.lineStyle(1.5, COLORS.GOLD, 0.5);
    this.strokePathPolyline(toWorld);

    // Layer 4 — flowing chevrons along the path showing direction.
    //
    // Chevrons should appear to travel FROM entry (waypoint 0) TO exit
    // (last waypoint). We track `pathFlowOffset` growing over time and
    // want each chevron's local `d` within a segment to grow with it,
    // so the chevron slides forward along its segment until it wraps.
    //
    // For a chevron at global position P on the path, local d in this
    // segment is `P - distAccum`. Chevrons live at globals
    // `pathFlowOffset + k*step`, so local d satisfies
    //   (d + distAccum) mod step == pathFlowOffset mod step
    // → d = ((pathFlowOffset - distAccum) mod step + step) mod step
    const step = 36; // distance between chevrons
    let distAccum = 0;
    for (let i = 1; i < this.currentPathWaypoints.length; i++) {
      const prev = toWorld(this.currentPathWaypoints[i - 1]!);
      const curr = toWorld(this.currentPathWaypoints[i]!);
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen === 0) continue;
      const ux = dx / segLen;
      const uy = dy / segLen;

      let d = (((this.pathFlowOffset - distAccum) % step) + step) % step;
      while (d < segLen) {
        const cx = prev.x + ux * d;
        const cy = prev.y + uy * d;
        const tip = { x: cx + ux * 4, y: cy + uy * 4 };
        const px = -uy;
        const py = ux;
        const base1 = { x: cx - ux * 2 + px * 3, y: cy - uy * 2 + py * 3 };
        const base2 = { x: cx - ux * 2 - px * 3, y: cy - uy * 2 - py * 3 };
        this.pathGraphics.fillStyle(COLORS.GOLD, 0.85);
        this.pathGraphics.fillTriangle(tip.x, tip.y, base1.x, base1.y, base2.x, base2.y);
        d += step;
      }
      distAccum += segLen;
    }
  }

  /** Helper — draw a single polyline through all waypoints. */
  private strokePathPolyline(toWorld: (wp: GridPosition) => { x: number; y: number }): void {
    this.pathGraphics.beginPath();
    const first = toWorld(this.currentPathWaypoints[0]!);
    this.pathGraphics.moveTo(first.x, first.y);
    for (let i = 1; i < this.currentPathWaypoints.length; i++) {
      const p = toWorld(this.currentPathWaypoints[i]!);
      this.pathGraphics.lineTo(p.x, p.y);
    }
    this.pathGraphics.strokePath();
  }

  highlightCell(row: number, col: number, color: number, alpha = 0.25): void {
    this.highlightGraphics.clear();
    const x = this.originX + col * GRID.CELL_SIZE;
    const y = this.originY + row * GRID.CELL_SIZE;

    // Fill
    this.highlightGraphics.fillStyle(color, alpha);
    this.highlightGraphics.fillRect(x, y, GRID.CELL_SIZE, GRID.CELL_SIZE);

    // Inner glow border
    this.highlightGraphics.lineStyle(2, color, 0.6);
    this.highlightGraphics.strokeRect(x + 1, y + 1, GRID.CELL_SIZE - 2, GRID.CELL_SIZE - 2);

    // Corner brackets for "targeting" feel
    const t = 6;
    this.highlightGraphics.lineStyle(2, color, 0.9);
    // TL
    this.highlightGraphics.lineBetween(x, y, x + t, y);
    this.highlightGraphics.lineBetween(x, y, x, y + t);
    // TR
    this.highlightGraphics.lineBetween(x + GRID.CELL_SIZE - t, y, x + GRID.CELL_SIZE, y);
    this.highlightGraphics.lineBetween(x + GRID.CELL_SIZE, y, x + GRID.CELL_SIZE, y + t);
    // BL
    this.highlightGraphics.lineBetween(x, y + GRID.CELL_SIZE - t, x, y + GRID.CELL_SIZE);
    this.highlightGraphics.lineBetween(x, y + GRID.CELL_SIZE, x + t, y + GRID.CELL_SIZE);
    // BR
    this.highlightGraphics.lineBetween(x + GRID.CELL_SIZE - t, y + GRID.CELL_SIZE, x + GRID.CELL_SIZE, y + GRID.CELL_SIZE);
    this.highlightGraphics.lineBetween(x + GRID.CELL_SIZE, y + GRID.CELL_SIZE - t, x + GRID.CELL_SIZE, y + GRID.CELL_SIZE);
  }

  clearHighlight(): void {
    this.highlightGraphics.clear();
  }

  drawRangeCircle(row: number, col: number, range: number, color: number): void {
    const cx = this.originX + col * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
    const cy = this.originY + row * GRID.CELL_SIZE + GRID.CELL_SIZE / 2;
    const radius = range * GRID.CELL_SIZE;

    // Outer soft halo
    this.highlightGraphics.lineStyle(2, color, 0.08);
    this.highlightGraphics.strokeCircle(cx, cy, radius + 1);
    // Main ring
    this.highlightGraphics.lineStyle(1, color, 0.35);
    this.highlightGraphics.strokeCircle(cx, cy, radius);
    // Inner faint fill
    this.highlightGraphics.fillStyle(color, 0.03);
    this.highlightGraphics.fillCircle(cx, cy, radius);
  }

  drawPath(waypoints: GridPosition[]): void {
    this.currentPathWaypoints = waypoints;
    // Drawing handled in update()
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
    this.baseFillGraphics.destroy();
    this.gridGraphics.destroy();
    this.frameGraphics.destroy();
    this.obstacleGraphics.destroy();
    this.portalGraphics.destroy();
    this.scanLineGraphics.destroy();
    this.pathGraphics.destroy();
    this.highlightGraphics.destroy();
  }
}
