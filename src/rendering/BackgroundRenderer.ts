import Phaser from 'phaser';
import { GAME, COLORS } from '../constants';
import { randomRange } from '../utils/MathUtils';

const ELEMENT_PALETTE = [
  COLORS.VOID,
  COLORS.WIND,
  COLORS.FIRE,
  COLORS.WATER,
  COLORS.LIGHTNING,
  COLORS.ACCENT_CYAN,
  COLORS.ACCENT_PINK,
  COLORS.ACCENT_PURPLE,
];

type ShapeKind = 'circle' | 'triangle' | 'hexagon' | 'octagon';
const SHAPE_KINDS: ShapeKind[] = ['circle', 'triangle', 'hexagon', 'octagon'];

export class BackgroundRenderer {
  private scene: Phaser.Scene;
  private vignette: Phaser.GameObjects.Graphics;
  private scanlines: Phaser.GameObjects.Graphics;
  private shapes: Phaser.GameObjects.Graphics[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.vignette = this.createVignette();
    this.shapes = this.createFloatingShapes();
    this.scanlines = this.createScanlines();
  }

  /* ------------------------------------------------------------------ */
  /*  Vignette — dark edges / corners                                   */
  /* ------------------------------------------------------------------ */

  private createVignette(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.setDepth(-2);

    const steps = 20;
    const maxInset = 150;

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1); // 0 = outermost, 1 = innermost
      const alpha = 0.4 * (1 - t); // 0.4 -> 0.0
      const inset = maxInset * t;

      g.fillStyle(0x000000, alpha);
      g.fillRect(inset, inset, GAME.WIDTH - inset * 2, GAME.HEIGHT - inset * 2);
    }

    return g;
  }

  /* ------------------------------------------------------------------ */
  /*  Floating geometric outlines                                       */
  /* ------------------------------------------------------------------ */

  private createFloatingShapes(): Phaser.GameObjects.Graphics[] {
    const shapes: Phaser.GameObjects.Graphics[] = [];

    for (let i = 0; i < 8; i++) {
      const kind = SHAPE_KINDS[Math.floor(Math.random() * SHAPE_KINDS.length)] ?? 'circle';
      const size = randomRange(60, 180);
      const color = ELEMENT_PALETTE[Math.floor(Math.random() * ELEMENT_PALETTE.length)] ?? COLORS.ACCENT_CYAN;
      const x = randomRange(0, GAME.WIDTH);
      const y = randomRange(0, GAME.HEIGHT);

      const g = this.scene.add.graphics();
      g.setDepth(-1);
      g.setPosition(x, y);
      g.setBlendMode(Phaser.BlendModes.ADD);

      g.lineStyle(1, color, 0.03);
      this.drawShape(g, kind, size);

      // Slow position drift
      const driftTween = this.scene.tweens.add({
        targets: g,
        x: x + randomRange(-100, 100),
        y: y + randomRange(-100, 100),
        duration: randomRange(15000, 30000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Slow rotation
      const rotTween = this.scene.tweens.add({
        targets: g,
        rotation: Math.PI * 2,
        duration: randomRange(20000, 40000),
        repeat: -1,
        ease: 'Linear',
      });

      this.tweens.push(driftTween, rotTween);
      shapes.push(g);
    }

    return shapes;
  }

  private drawShape(g: Phaser.GameObjects.Graphics, kind: ShapeKind, size: number): void {
    switch (kind) {
      case 'circle':
        g.strokeCircle(0, 0, size / 2);
        break;
      case 'triangle':
        this.strokePolygon(g, 3, size / 2);
        break;
      case 'hexagon':
        this.strokePolygon(g, 6, size / 2);
        break;
      case 'octagon':
        this.strokePolygon(g, 8, size / 2);
        break;
    }
  }

  private strokePolygon(g: Phaser.GameObjects.Graphics, sides: number, radius: number): void {
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
      points.push(new Phaser.Math.Vector2(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ));
    }

    g.beginPath();
    const first = points[0];
    if (first) g.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const pt = points[i];
      if (pt) g.lineTo(pt.x, pt.y);
    }
    g.closePath();
    g.strokePath();
  }

  /* ------------------------------------------------------------------ */
  /*  Scanline overlay                                                  */
  /* ------------------------------------------------------------------ */

  private createScanlines(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.setDepth(-0.5);
    g.lineStyle(1, 0xffffff, 0.012);

    for (let y = 0; y < GAME.HEIGHT; y += 4) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(GAME.WIDTH, y);
      g.strokePath();
    }

    return g;
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                           */
  /* ------------------------------------------------------------------ */

  destroy(): void {
    for (const tween of this.tweens) {
      tween.destroy();
    }
    this.tweens.length = 0;

    this.vignette.destroy();

    for (const shape of this.shapes) {
      shape.destroy();
    }
    this.shapes.length = 0;

    this.scanlines.destroy();
  }
}
