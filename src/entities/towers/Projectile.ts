import Phaser from 'phaser';
import { Element } from '../../constants';
import { ElementSystem } from '../../systems/ElementSystem';
import { distance } from '../../utils/MathUtils';
import { showDamageNumber } from '../../rendering/GameEffects';
import { audioManager } from '../../systems/AudioManager';
import { BaseEnemy } from '../enemies/BaseEnemy';

export class Projectile extends Phaser.GameObjects.Graphics {
  private target: BaseEnemy;
  private speed = 300;
  private damage: number;
  private element: Element | null;
  private alive = true;
  private elementColor: number;
  private trailGraphics: Phaser.GameObjects.Graphics;
  private positionHistory: { x: number; y: number }[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    target: BaseEnemy,
    damage: number,
    element: Element | null,
  ) {
    super(scene);
    this.setPosition(x, y);
    this.target = target;
    this.damage = damage;
    this.element = element;
    this.elementColor = ElementSystem.getColor(element);

    // Main projectile with glow — ADD blend for neon effect
    this.setBlendMode(Phaser.BlendModes.ADD);
    this.fillStyle(this.elementColor, 0.8);
    this.fillCircle(0, 0, 4);
    this.lineStyle(1.5, this.elementColor, 0.4);
    this.strokeCircle(0, 0, 7);
    // White hot center
    this.fillStyle(0xffffff, 0.5);
    this.fillCircle(0, 0, 2);

    // Trail graphics — separate ADD-blend layer behind projectile
    this.trailGraphics = scene.add.graphics();
    this.trailGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.trailGraphics.setDepth(5);

    this.setDepth(6);
    scene.add.existing(this);
  }

  update(_time: number, delta: number): boolean {
    if (!this.alive) return true;

    if (this.target.isDead()) {
      this.cleanup();
      return true;
    }

    // Record trail position
    this.positionHistory.push({ x: this.x, y: this.y });
    if (this.positionHistory.length > 4) this.positionHistory.shift();

    // Draw trail
    this.trailGraphics.clear();
    for (let i = 0; i < this.positionHistory.length; i++) {
      const pos = this.positionHistory[i]!;
      const frac = i / this.positionHistory.length;
      this.trailGraphics.fillStyle(this.elementColor, frac * 0.35);
      this.trailGraphics.fillCircle(pos.x, pos.y, 1.5 + frac * 2.5);
    }

    const dist = distance(this.x, this.y, this.target.x, this.target.y);
    const step = this.speed * (delta / 1000);

    if (dist <= step) {
      // Hit target
      const hpBefore = this.target.getHP();
      this.target.takeDamage(this.damage, this.element);
      const actualDamage = Math.round(hpBefore - this.target.getHP());

      if (actualDamage > 0) {
        const effectiveness = ElementSystem.getEffectiveness(this.element, this.target.element);
        showDamageNumber(this.scene, this.target.x, this.target.y - 15, actualDamage, this.elementColor, effectiveness > 1);
      }

      // Impact flash — expanding ring at hit location
      this.playImpactFlash(this.target.x, this.target.y);

      audioManager.playSFX('tower_fire');
      this.cleanup();
      return true;
    }

    const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    this.x += Math.cos(angle) * step;
    this.y += Math.sin(angle) * step;

    return false;
  }

  private playImpactFlash(tx: number, ty: number): void {
    const flash = this.scene.add.graphics();
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(7);
    const progress = { t: 0 };
    const color = this.elementColor;

    this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: 150,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        flash.clear();
        const r = 5 + progress.t * 14;
        const a = 0.45 * (1 - progress.t);
        flash.lineStyle(2, color, a);
        flash.strokeCircle(tx, ty, r);
        flash.fillStyle(color, a * 0.25);
        flash.fillCircle(tx, ty, r * 0.4);
      },
      onComplete: () => flash.destroy(),
    });
  }

  isAlive(): boolean {
    return this.alive;
  }

  private cleanup(): void {
    this.alive = false;
    this.trailGraphics.destroy();
    this.destroy();
  }
}
