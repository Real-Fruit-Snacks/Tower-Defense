import Phaser from 'phaser';
import { COLORS } from '../constants';
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

interface FloatingShape {
  gfx: Phaser.GameObjects.Graphics;
  kind: ShapeKind;
  size: number;
  color: number;
  // Position stored as normalized 0..1 of the *viewport* so we can reflow
  // on resize without losing the drift tween.
  driftTweens: Phaser.Tweens.Tween[];
}

/**
 * Fills the entire viewport with atmospheric vignette + floating neon
 * shapes + subtle scanlines. Resize-aware: redraws on `scale.resize` so
 * the game looks full-screen at any aspect ratio.
 *
 * Optionally accepts a target Layer; every graphics object it creates is
 * added to that layer so GameScene can route background-only content to
 * a dedicated camera.
 */
export class BackgroundRenderer {
  private scene: Phaser.Scene;
  private vignette: Phaser.GameObjects.Graphics;
  private scanlines: Phaser.GameObjects.Graphics;
  private shapes: FloatingShape[] = [];
  private allTweens: Phaser.Tweens.Tween[] = [];
  private resizeHandler: () => void;
  private targetLayer?: Phaser.GameObjects.Layer;

  constructor(scene: Phaser.Scene, targetLayer?: Phaser.GameObjects.Layer) {
    this.scene = scene;
    this.targetLayer = targetLayer;

    this.vignette = this.addTo(this.scene.add.graphics().setDepth(-2));
    this.scanlines = this.addTo(this.scene.add.graphics().setDepth(-0.5));
    this.drawVignette();
    this.drawScanlines();

    this.createFloatingShapes();

    // Redraw vignette + scanlines + reposition shapes when the viewport
    // changes (window resize, fullscreen toggle, orientation flip).
    this.resizeHandler = (): void => {
      this.drawVignette();
      this.drawScanlines();
    };
    this.scene.scale.on('resize', this.resizeHandler);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private get viewW(): number { return this.scene.scale.width; }
  private get viewH(): number { return this.scene.scale.height; }

  private drawVignette(): void {
    const g = this.vignette;
    g.clear();
    const steps = 20;
    const maxInset = Math.min(150, Math.min(this.viewW, this.viewH) * 0.2);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const alpha = 0.4 * (1 - t);
      const inset = maxInset * t;
      g.fillStyle(0x000000, alpha);
      g.fillRect(inset, inset, this.viewW - inset * 2, this.viewH - inset * 2);
    }
  }

  private drawScanlines(): void {
    const g = this.scanlines;
    g.clear();
    g.lineStyle(1, 0xffffff, 0.012);
    for (let y = 0; y < this.viewH; y += 4) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.viewW, y);
      g.strokePath();
    }
  }

  /**
   * Routes a scene-root GameObject into our target layer (if one was
   * provided). Returns the object for chaining.
   */
  private addTo<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    if (this.targetLayer) this.targetLayer.add(obj);
    return obj;
  }

  private createFloatingShapes(): void {
    for (let i = 0; i < 8; i++) {
      const kind = SHAPE_KINDS[Math.floor(Math.random() * SHAPE_KINDS.length)] ?? 'circle';
      const size = randomRange(60, 180);
      const color = ELEMENT_PALETTE[Math.floor(Math.random() * ELEMENT_PALETTE.length)] ?? COLORS.ACCENT_CYAN;
      // Position within the *current* viewport so shapes fill the whole
      // screen regardless of aspect ratio.
      const x = randomRange(0, this.viewW);
      const y = randomRange(0, this.viewH);

      const g = this.addTo(this.scene.add.graphics());
      g.setDepth(-1);
      g.setPosition(x, y);
      g.setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(1, color, 0.03);
      this.drawShape(g, kind, size);

      const driftTween = this.scene.tweens.add({
        targets: g,
        x: x + randomRange(-100, 100),
        y: y + randomRange(-100, 100),
        duration: randomRange(15000, 30000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const rotTween = this.scene.tweens.add({
        targets: g,
        rotation: Math.PI * 2,
        duration: randomRange(20000, 40000),
        repeat: -1,
        ease: 'Linear',
      });

      this.allTweens.push(driftTween, rotTween);
      this.shapes.push({ gfx: g, kind, size, color, driftTweens: [driftTween, rotTween] });
    }
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

  destroy(): void {
    this.scene.scale.off('resize', this.resizeHandler);
    for (const tween of this.allTweens) tween.destroy();
    this.allTweens.length = 0;
    this.vignette.destroy();
    for (const s of this.shapes) s.gfx.destroy();
    this.shapes.length = 0;
    this.scanlines.destroy();
  }
}
