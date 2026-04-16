import Phaser from 'phaser';

export class ShapeRenderer {
  // ============ Core Shape Primitives ============

  static drawPolygon(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number,
    sides: number, size: number,
    fillColor: number, fillAlpha: number,
    strokeColor: number, strokeWidth: number,
  ): void {
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 / sides) * i - Math.PI / 2;
      points.push(new Phaser.Geom.Point(x + size * Math.cos(angle), y + size * Math.sin(angle)));
    }
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillPoints(points, true);
    if (strokeWidth > 0) {
      graphics.lineStyle(strokeWidth, strokeColor, 1);
      graphics.strokePoints(points, true);
    }
  }

  static drawDiamond(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number,
    size: number,
    fillColor: number, fillAlpha: number,
    strokeColor: number, strokeWidth: number,
  ): void {
    const points = [
      new Phaser.Geom.Point(x, y - size),
      new Phaser.Geom.Point(x + size * 0.7, y),
      new Phaser.Geom.Point(x, y + size),
      new Phaser.Geom.Point(x - size * 0.7, y),
    ];
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillPoints(points, true);
    if (strokeWidth > 0) {
      graphics.lineStyle(strokeWidth, strokeColor, 1);
      graphics.strokePoints(points, true);
    }
  }

  static drawStar(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number,
    size: number,
    fillColor: number, fillAlpha: number,
    strokeColor: number, strokeWidth: number,
    numPoints = 5,
  ): void {
    const pts: Phaser.Geom.Point[] = [];
    const innerSize = size * 0.45;
    for (let i = 0; i < numPoints * 2; i++) {
      const angle = (Math.PI * 2 / (numPoints * 2)) * i - Math.PI / 2;
      const r = i % 2 === 0 ? size : innerSize;
      pts.push(new Phaser.Geom.Point(x + r * Math.cos(angle), y + r * Math.sin(angle)));
    }
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillPoints(pts, true);
    if (strokeWidth > 0) {
      graphics.lineStyle(strokeWidth, strokeColor, 1);
      graphics.strokePoints(pts, true);
    }
  }

  // ============ Generic Shape Router ============

  private static drawShape(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number,
    shape: string, size: number,
    fillColor: number, fillAlpha: number,
    strokeColor: number, strokeWidth: number,
  ): void {
    switch (shape) {
      case 'triangle': this.drawPolygon(graphics, x, y, 3, size, fillColor, fillAlpha, strokeColor, strokeWidth); break;
      case 'square': this.drawPolygon(graphics, x, y, 4, size, fillColor, fillAlpha, strokeColor, strokeWidth); break;
      case 'pentagon': this.drawPolygon(graphics, x, y, 5, size, fillColor, fillAlpha, strokeColor, strokeWidth); break;
      case 'hexagon': this.drawPolygon(graphics, x, y, 6, size, fillColor, fillAlpha, strokeColor, strokeWidth); break;
      case 'octagon': this.drawPolygon(graphics, x, y, 8, size, fillColor, fillAlpha, strokeColor, strokeWidth); break;
      case 'diamond': this.drawDiamond(graphics, x, y, size, fillColor, fillAlpha, strokeColor, strokeWidth); break;
      case 'star': this.drawStar(graphics, x, y, size, fillColor, fillAlpha, strokeColor, strokeWidth); break;
      case 'circle':
      default:
        graphics.fillStyle(fillColor, fillAlpha);
        graphics.fillCircle(x, y, size);
        if (strokeWidth > 0) { graphics.lineStyle(strokeWidth, strokeColor, 1); graphics.strokeCircle(x, y, size); }
        break;
    }
  }

  // ============ Simple Flat Drawing (for UI slots, previews) ============

  static drawTowerShape(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number,
    shape: string, size: number, color: number,
  ): void {
    this.drawShape(graphics, x, y, shape, size, color, 0.3, color, 2);
  }

  static drawEnemyShape(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number,
    shape: string, size: number, color: number,
  ): void {
    this.drawShape(graphics, x, y, shape, size, color, 0.5, color, 2);
  }

  // ============ Multi-Pass Glow Drawing (for live game entities) ============

  /**
   * Draw a tower with neon glow effect — 3-pass rendering:
   * 1. Outer glow on glowGraphics (ADD blend, large + faint)
   * 2. Main shape on mainGraphics (normal blend, outline + fill)
   * 3. Bright core on mainGraphics (small + bright)
   */
  static drawTowerShapeWithGlow(
    glowGraphics: Phaser.GameObjects.Graphics,
    mainGraphics: Phaser.GameObjects.Graphics,
    x: number, y: number,
    shape: string, size: number, color: number,
  ): void {
    // Pass 1: Outer glow (on ADD-blend graphics) — large, faint
    const outerSize = size * 1.8;
    this.drawShape(glowGraphics, x, y, shape, outerSize, color, 0.1, color, 0);

    // Also add a soft circular glow behind
    glowGraphics.fillStyle(color, 0.06);
    glowGraphics.fillCircle(x, y, size * 2.2);

    // Pass 2: Main shape — standard outline
    this.drawShape(mainGraphics, x, y, shape, size, color, 0.25, color, 2);

    // Pass 3: Bright core — smaller, brighter fill
    const coreSize = size * 0.5;
    this.drawShape(mainGraphics, x, y, shape, coreSize, color, 0.55, color, 0);

    // Inner white hot spot
    mainGraphics.fillStyle(0xffffff, 0.12);
    mainGraphics.fillCircle(x, y, coreSize * 0.5);
  }

  /**
   * Draw an enemy with neon glow effect — 3-pass rendering:
   * 1. Outer glow aura (ADD blend)
   * 2. Main shape with outline
   * 3. Bright core center
   */
  static drawEnemyShapeWithGlow(
    glowGraphics: Phaser.GameObjects.Graphics,
    mainGraphics: Phaser.GameObjects.Graphics,
    x: number, y: number,
    shape: string, size: number, color: number,
  ): void {
    // Pass 1: Outer glow aura
    glowGraphics.fillStyle(color, 0.1);
    glowGraphics.fillCircle(x, y, size * 1.7);

    // Pass 2: Main shape
    this.drawShape(mainGraphics, x, y, shape, size, color, 0.45, color, 2);

    // Pass 3: Bright core
    const coreSize = size * 0.45;
    this.drawShape(mainGraphics, x, y, shape, coreSize, color, 0.6, color, 0);
  }

  // ============ Texture Generation ============

  static generateTexture(
    scene: Phaser.Scene,
    key: string, shape: string,
    size: number, color: number,
    type: 'tower' | 'enemy' = 'tower',
  ): void {
    if (scene.textures.exists(key)) return;
    const rt = scene.add.renderTexture(0, 0, size * 2 + 4, size * 2 + 4);
    const graphics = scene.add.graphics();

    if (type === 'tower') {
      this.drawTowerShape(graphics, size + 2, size + 2, shape, size, color);
    } else {
      this.drawEnemyShape(graphics, size + 2, size + 2, shape, size, color);
    }

    rt.draw(graphics);
    rt.saveTexture(key);
    graphics.destroy();
    rt.destroy();
  }
}
